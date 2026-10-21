package com.crustandco.customer.data.repository

import com.crustandco.customer.core.AppResult
import com.crustandco.customer.core.map
import com.crustandco.customer.data.remote.CrustApi
import com.crustandco.customer.data.remote.apiCall
import com.crustandco.customer.data.remote.toDomain
import com.crustandco.customer.core.AppError
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

// The server allows up to 100 per page. The whole menu is a couple of pages, so the app follows the cursor until it ends.
private const val PAGE_SIZE = 100
private const val MAX_PAGES = 20

class RemoteCatalogRepository(private val api: CrustApi) : CatalogRepository {
    override suspend fun categories(): AppResult<List<Category>> =
        apiCall { api.categories() }.map { page -> page.items.map { it.toDomain() } }

    override suspend fun products(categoryId: String?, search: String?): AppResult<List<Product>> {
        val all = mutableListOf<Product>()
        var cursor: String? = null
        repeat(MAX_PAGES) {
            when (val result = apiCall { api.products(category = categoryId, search = search?.takeIf { it.isNotBlank() }, cursor = cursor, limit = PAGE_SIZE) }) {
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
        apiCall { api.product(id) }.map { it.toDomain() }
}

class RemoteOrderRepository(private val api: CrustApi) : OrderRepository {
    override suspend fun orders(): AppResult<List<Order>> =
        apiCall { api.orders() }.map { page -> page.items.map { it.toDomain() } }

    override suspend fun order(id: String): AppResult<Order> =
        apiCall { api.order(id) }.map { it.toDomain() }
}

/** docs/api-contract.md has no promotions endpoint, so none is invented: the live app shows no banner until one exists. */
class RemotePromotionRepository : PromotionRepository {
    override suspend fun promotions(): AppResult<List<Promotion>> = AppResult.Success(emptyList())
}

// docs/api-contract.md lists these endpoints but no request/response schemas yet (see Android/docs/api-assumptions.md),
// and the app must not invent them. Until Antigravity publishes final schemas the live mode reports them as unavailable.
class UnavailableAddressRepository : AddressRepository {
    override suspend fun addresses(): AppResult<List<Address>> = AppResult.Failure(AppError.NotAvailable)
    override suspend fun add(address: NewAddress): AppResult<Address> = AppResult.Failure(AppError.NotAvailable)
}

class UnavailablePricingRepository : PricingRepository {
    override suspend fun quote(items: List<CheckoutItem>, couponCode: String?): AppResult<Quote> = AppResult.Failure(AppError.NotAvailable)
}

class UnavailableCheckoutRepository : CheckoutRepository {
    override suspend fun placeOrder(request: CheckoutRequest): AppResult<com.crustandco.customer.domain.Order> = AppResult.Failure(AppError.NotAvailable)
}
