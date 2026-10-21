package com.crustandco.customer.data.mock

import com.crustandco.customer.core.AppError
import com.crustandco.customer.core.AppResult
import com.crustandco.customer.domain.Address
import com.crustandco.customer.domain.AddressRepository
import com.crustandco.customer.domain.CatalogRepository
import com.crustandco.customer.domain.CheckoutItem
import com.crustandco.customer.domain.CheckoutRepository
import com.crustandco.customer.domain.CheckoutRequest
import com.crustandco.customer.domain.NewAddress
import com.crustandco.customer.domain.PricingRepository
import com.crustandco.customer.domain.Quote
import com.crustandco.customer.domain.Order
import com.crustandco.customer.domain.OrderRepository
import com.crustandco.customer.domain.Category
import com.crustandco.customer.domain.Product
import com.crustandco.customer.domain.Promotion
import com.crustandco.customer.domain.PromotionRepository
import kotlinx.coroutines.delay

// Mock repositories: same interfaces as the Remote* ones, so the UI cannot tell the difference. Data lives in MockData.kt.

private const val LATENCY_MS = 150L

/** What a catalog search matches: the name, the description or the category's name, like "pizza" finding every pizza. */
private fun Product.matches(query: String): Boolean {
    val category = demoCategories.firstOrNull { it.id == categoryId }?.name.orEmpty()
    return listOf(name, description, category).any { it.contains(query, ignoreCase = true) }
}

class MockCatalogRepository(private val latencyMs: Long = LATENCY_MS) : CatalogRepository {
    override suspend fun categories(): AppResult<List<Category>> {
        delay(latencyMs)
        return AppResult.Success(demoCategories)
    }

    override suspend fun products(categoryId: String?, search: String?): AppResult<List<Product>> {
        delay(latencyMs)
        val query = search?.trim().orEmpty()
        return AppResult.Success(
            demoProducts.filter { p ->
                (categoryId == null || p.categoryId == categoryId) &&
                    (query.isEmpty() || p.matches(query))
            },
        )
    }

    override suspend fun product(id: String): AppResult<Product> {
        delay(latencyMs)
        return demoProducts.firstOrNull { it.id == id }?.let { AppResult.Success(it) } ?: AppResult.Failure(AppError.NotFound)
    }
}

internal class MockOrderRepository(private val backend: MockBackend, private val latencyMs: Long = LATENCY_MS) : OrderRepository {
    override suspend fun orders(): AppResult<List<Order>> {
        delay(latencyMs)
        return AppResult.Success(backend.orders())
    }

    override suspend fun order(id: String): AppResult<Order> {
        delay(latencyMs)
        return backend.order(id)?.let { AppResult.Success(it) } ?: AppResult.Failure(AppError.NotFound)
    }
}

internal class MockAddressRepository(private val backend: MockBackend, private val latencyMs: Long = LATENCY_MS) : AddressRepository {
    override suspend fun addresses(): AppResult<List<Address>> {
        delay(latencyMs)
        return AppResult.Success(backend.addresses())
    }

    override suspend fun add(address: NewAddress): AppResult<Address> {
        delay(latencyMs)
        return backend.addAddress(address)
    }
}

/**
 * Loads the products a cart refers to from whichever catalog the app uses, so the demo "server" prices the live menu the
 * same way it prices the built-in one. A product the catalog no longer has is left out; the quote then reports it as unavailable.
 */
internal suspend fun loadProducts(catalog: CatalogRepository, items: List<CheckoutItem>): AppResult<List<Product>> {
    val products = mutableListOf<Product>()
    for (id in items.map { it.productId }.distinct()) {
        when (val result = catalog.product(id)) {
            is AppResult.Success -> products += result.data
            is AppResult.Failure -> if (result.error != AppError.NotFound) return AppResult.Failure(result.error)
        }
    }
    return AppResult.Success(products)
}

class MockPricingRepository(
    private val latencyMs: Long = LATENCY_MS,
    private val catalog: CatalogRepository = MockCatalogRepository(0),
) : PricingRepository {
    override suspend fun quote(items: List<CheckoutItem>, couponCode: String?): AppResult<Quote> {
        delay(latencyMs)
        return when (val products = loadProducts(catalog, items)) {
            is AppResult.Failure -> AppResult.Failure(products.error)
            is AppResult.Success -> MockPricing.quote(products.data, items, couponCode)
        }
    }
}

internal class MockCheckoutRepository(
    private val backend: MockBackend,
    private val latencyMs: Long = 600L,
    private val catalog: CatalogRepository = MockCatalogRepository(0),
) : CheckoutRepository {
    override suspend fun placeOrder(request: CheckoutRequest): AppResult<Order> {
        delay(latencyMs)
        return when (val products = loadProducts(catalog, request.items)) {
            is AppResult.Failure -> AppResult.Failure(products.error)
            is AppResult.Success -> backend.place(request, products.data)
        }
    }
}

class MockPromotionRepository(private val latencyMs: Long = LATENCY_MS) : PromotionRepository {
    override suspend fun promotions(): AppResult<List<Promotion>> {
        delay(latencyMs)
        return AppResult.Success(demoPromotions)
    }
}
