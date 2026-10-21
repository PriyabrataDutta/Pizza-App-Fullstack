package com.crustandco.customer

import com.crustandco.customer.core.AppResult
import com.crustandco.customer.core.Money
import com.crustandco.customer.domain.CatalogRepository
import com.crustandco.customer.domain.Promotion
import com.crustandco.customer.domain.PromotionRepository
import com.crustandco.customer.domain.Category
import com.crustandco.customer.domain.DietaryType
import com.crustandco.customer.domain.Product
import com.crustandco.customer.domain.Variant

fun product(
    id: String = "p1",
    categoryId: String = "c1",
    name: String = "Margherita",
    bestseller: Boolean = false,
    dietary: DietaryType = DietaryType.Veg,
    variants: List<Variant> = listOf(
        Variant("v1", "Small", Money(19900), true),
        Variant("v2", "Large", Money(39900), true),
    ),
) = Product(
    id = id, categoryId = categoryId, name = name, description = "", imageUrl = null,
    dietaryType = dietary, isSpicy = false, isBestseller = bestseller,
    variants = variants, customizationGroups = emptyList(),
)

fun category(id: String, name: String = id) = Category(id = id, name = name, imageUrl = null)

/** Scriptable repository: tests decide what each call returns, and when. */
class FakeCatalogRepository : CatalogRepository {
    var categoriesResult: AppResult<List<Category>> = AppResult.Success(emptyList())
    var productsHandler: suspend (categoryId: String?) -> AppResult<List<Product>> = { AppResult.Success(emptyList()) }
    val requestedCategoryIds = mutableListOf<String?>()
    val requestedQueries = mutableListOf<String?>()

    override suspend fun categories() = categoriesResult

    override suspend fun products(categoryId: String?, search: String?): AppResult<List<Product>> {
        requestedCategoryIds += categoryId
        requestedQueries += search
        return productsHandler(categoryId)
    }

    override suspend fun product(id: String): AppResult<Product> = AppResult.Success(com.crustandco.customer.product(id = id))
}

class FakePromotions(var result: AppResult<List<Promotion>> = AppResult.Success(emptyList())) : PromotionRepository {
    override suspend fun promotions() = result
}
