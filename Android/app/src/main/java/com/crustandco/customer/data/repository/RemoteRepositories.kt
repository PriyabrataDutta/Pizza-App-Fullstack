package com.crustandco.customer.data.repository

import com.crustandco.customer.core.AppResult
import com.crustandco.customer.core.map
import com.crustandco.customer.data.remote.CrustApi
import com.crustandco.customer.data.remote.CheckoutBody
import com.crustandco.customer.data.remote.GuestSession
import com.crustandco.customer.data.remote.QuoteBody
import com.crustandco.customer.data.remote.toBody
import com.crustandco.customer.data.remote.apiCall
import com.crustandco.customer.data.remote.toDomain
import com.crustandco.customer.domain.Address
import com.crustandco.customer.domain.AddressRepository
import com.crustandco.customer.domain.CatalogRepository
import com.crustandco.customer.domain.CheckoutItem
import com.crustandco.customer.domain.CheckoutRepository
import com.crustandco.customer.domain.CheckoutRequest
import com.crustandco.customer.domain.NewAddress
import com.crustandco.customer.domain.PricingRepository
import com.crustandco.customer.domain.Quote
import com.crustandco.customer.domain.Category
import com.crustandco.customer.domain.Order
import com.crustandco.customer.domain.OrderRepository
import com.crustandco.customer.domain.Product
import com.crustandco.customer.domain.Promotion
import com.crustandco.customer.domain.PromotionRepository
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

// The server allows up to 200 per page. The whole menu is a couple of pages, so the app follows the cursor until it ends.
private const val PAGE_SIZE = 200
private const val MAX_PAGES = 20

/**
 * The menu is fetched once and shared: Home, Menu and its category tabs all read the same in-memory copy for [FRESH_MS], so opening
 * a screen or switching a category costs no network at all. A refresh that fails (offline) keeps serving the last copy.
 * [api] is a provider so the network stack is only built when the first request is made, not while the app starts.
 */
class RemoteCatalogRepository(private val api: () -> CrustApi, private val now: () -> Long = System::currentTimeMillis) : CatalogRepository {
    private class Cached<T>(val value: T, val at: Long)

    // Separate locks so categories and the menu load side by side, while each is still fetched only once.
    private val categoriesLock = Mutex()
    private val menuLock = Mutex()
    private var menu: Cached<List<Product>>? = null
    private var categoryList: Cached<List<Category>>? = null

    override suspend fun categories(): AppResult<List<Category>> = categoriesLock.withLock {
        categoryList?.takeIf { now() - it.at < FRESH_MS }?.let { return AppResult.Success(it.value) }
        when (val result = apiCall { api().categories() }.map { page -> page.items.map { it.toDomain() } }) {
            is AppResult.Success -> { categoryList = Cached(result.data, now()); result }
            is AppResult.Failure -> categoryList?.let { AppResult.Success(it.value) } ?: result
        }
    }

    override suspend fun products(categoryId: String?, search: String?): AppResult<List<Product>> {
        val query = search?.takeIf { it.isNotBlank() }
        // Searching asks the server (it knows about tags and descriptions); browsing by category filters the shared copy.
        if (query != null) return fetchProducts(categoryId, query)
        return when (val all = wholeMenu()) {
            is AppResult.Failure -> all
            is AppResult.Success -> AppResult.Success(if (categoryId == null) all.data else all.data.filter { it.categoryId == categoryId })
        }
    }

    private suspend fun wholeMenu(): AppResult<List<Product>> = menuLock.withLock {
        menu?.takeIf { now() - it.at < FRESH_MS }?.let { return AppResult.Success(it.value) }
        when (val result = fetchProducts(null, null)) {
            is AppResult.Success -> { menu = Cached(result.data, now()); result }
            is AppResult.Failure -> menu?.let { AppResult.Success(it.value) } ?: result
        }
    }

    private suspend fun fetchProducts(categoryId: String?, search: String?): AppResult<List<Product>> {
        val all = mutableListOf<Product>()
        var cursor: String? = null
        repeat(MAX_PAGES) {
            when (val result = apiCall { api().products(category = categoryId, search = search, cursor = cursor, limit = PAGE_SIZE) }) {
                is AppResult.Failure -> return AppResult.Failure(result.error)
                is AppResult.Success -> {
                    all += result.data.items.map { it.toDomain() }
                    cursor = result.data.nextCursor ?: return AppResult.Success(all)
                }
            }
        }
        return AppResult.Success(all)
    }

    override suspend fun product(id: String): AppResult<Product> =
        apiCall { api().product(id) }.map { it.toDomain() }

    private companion object {
        const val FRESH_MS = 60_000L
    }
}

/** The customer's orders. The token identifies this phone; the server returns only its own orders. */
class RemoteOrderRepository(private val session: GuestSession, private val api: () -> CrustApi) : OrderRepository {
    override suspend fun orders(): AppResult<List<Order>> =
        session.call { apiCall { api().orders() }.map { page -> page.items.map { it.toDomain() } } }

    override suspend fun order(id: String): AppResult<Order> =
        session.call { apiCall { api().order(id) }.map { it.toDomain() } }
}

class RemoteAddressRepository(private val session: GuestSession, private val api: () -> CrustApi) : AddressRepository {
    override suspend fun addresses(): AppResult<List<Address>> =
        session.call { apiCall { api().addresses() }.map { page -> page.items.map { it.toDomain() } } }

    override suspend fun add(address: NewAddress): AppResult<Address> =
        session.call { apiCall { api().addAddress(address.toBody()) }.map { it.toDomain() } }
}

class RemotePricingRepository(private val session: GuestSession, private val api: () -> CrustApi) : PricingRepository {
    override suspend fun quote(items: List<CheckoutItem>, couponCode: String?): AppResult<Quote> =
        session.call { apiCall { api().quote(QuoteBody(items.map { it.toBody() }, couponCode?.takeIf { it.isNotBlank() })) }.map { it.toDomain() } }
}

class RemoteCheckoutRepository(private val session: GuestSession, private val api: () -> CrustApi) : CheckoutRepository {
    override suspend fun placeOrder(request: CheckoutRequest): AppResult<Order> =
        session.call {
            apiCall {
                api().checkout(
                    CheckoutBody(
                        idempotencyKey = request.idempotencyKey,
                        addressId = request.addressId,
                        paymentMethod = request.paymentMethod.wire,
                        couponCode = request.couponCode?.takeIf { it.isNotBlank() },
                        instructions = request.instructions?.takeIf { it.isNotBlank() },
                        contactName = request.contactName?.takeIf { it.isNotBlank() },
                        contactPhone = request.contactPhone?.takeIf { it.isNotBlank() },
                        items = request.items.map { it.toBody() },
                    ),
                )
            }.map { it.toDomain() }
        }
}

/** docs/api-contract.md has no promotions endpoint, so none is invented: the live app shows no banner until one exists. */
class RemotePromotionRepository : PromotionRepository {
    override suspend fun promotions(): AppResult<List<Promotion>> = AppResult.Success(emptyList())
}
