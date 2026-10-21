package com.crustandco.customer.domain

import com.crustandco.customer.core.AppResult

// Repository interfaces. The UI and ViewModels depend only on these. Real (Retrofit) and mock implementations
// are interchangeable, chosen in AppContainer. Phase 2 adds addresses, coupons and checkout here.

interface CatalogRepository {
    suspend fun categories(): AppResult<List<Category>>

    /** First page only for now. Cursor pagination arrives with the finalized contract. */
    suspend fun products(categoryId: String? = null, search: String? = null): AppResult<List<Product>>

    suspend fun product(id: String): AppResult<Product>
}

interface OrderRepository {
    suspend fun orders(): AppResult<List<Order>>
    suspend fun order(id: String): AppResult<Order>
}

interface PromotionRepository {
    suspend fun promotions(): AppResult<List<Promotion>>
}
