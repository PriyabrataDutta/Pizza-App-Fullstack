package com.crustandco.customer.feature.menu

import com.crustandco.customer.FakeCatalogRepository
import com.crustandco.customer.FakePromotions
import com.crustandco.customer.data.local.InMemoryCartStore
import com.crustandco.customer.domain.CatalogRepository
import com.crustandco.customer.category
import com.crustandco.customer.core.AppError
import com.crustandco.customer.core.AppResult
import com.crustandco.customer.core.UiState
import com.crustandco.customer.domain.DietaryType
import com.crustandco.customer.domain.Product
import com.crustandco.customer.product
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/** These tests only care about the catalog; promotions and the cart are inert fakes. */
private fun MenuViewModel(catalog: CatalogRepository) = MenuViewModel(catalog, FakePromotions(), InMemoryCartStore())

@OptIn(ExperimentalCoroutinesApi::class)
class MenuViewModelTest {
    private lateinit var repo: FakeCatalogRepository

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        repo = FakeCatalogRepository()
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `shows loading until the first response arrives`() {
        val gate = CompletableDeferred<AppResult<List<Product>>>()
        repo.productsHandler = { gate.await() }

        val vm = MenuViewModel(repo)
        assertEquals(UiState.Loading, vm.state.value.products)

        gate.complete(AppResult.Success(listOf(product())))
        assertTrue(vm.state.value.products is UiState.Success)
    }

    @Test
    fun `loads categories and products on start`() {
        repo.categoriesResult = AppResult.Success(listOf(category("c1"), category("c2")))
        repo.productsHandler = { AppResult.Success(listOf(product(id = "a"), product(id = "b"))) }

        val state = MenuViewModel(repo).state.value

        assertEquals(2, state.categories.size)
        assertEquals(listOf("a", "b"), (state.products as UiState.Success).data.map { it.id })
        assertEquals(null, state.selectedCategoryId)
    }

    @Test
    fun `a product failure becomes an error state, not an empty list`() {
        repo.productsHandler = { AppResult.Failure(AppError.Network) }

        val products = MenuViewModel(repo).state.value.products

        assertEquals(UiState.Error(AppError.Network), products)
    }

    @Test
    fun `a categories failure does not hide the products`() {
        repo.categoriesResult = AppResult.Failure(AppError.Server)
        repo.productsHandler = { AppResult.Success(listOf(product())) }

        val state = MenuViewModel(repo).state.value

        assertTrue(state.categories.isEmpty())
        assertTrue(state.products is UiState.Success)
    }

    @Test
    fun `an empty result is a success with no items so the screen can show an empty state`() {
        repo.productsHandler = { AppResult.Success(emptyList()) }

        val products = MenuViewModel(repo).state.value.products

        assertEquals(UiState.Success(emptyList<Product>()), products)
    }

    @Test
    fun `selecting a category requests only that category`() {
        repo.productsHandler = { id -> AppResult.Success(listOf(product(id = "in-$id", categoryId = id ?: "all"))) }
        val vm = MenuViewModel(repo)

        vm.selectCategory("c2")

        assertEquals(listOf(null, "c2"), repo.requestedCategoryIds)
        assertEquals("c2", vm.state.value.selectedCategoryId)
        assertEquals("in-c2", ((vm.state.value.products) as UiState.Success).data.single().id)
    }

    @Test
    fun `selecting the same category again does not reload`() {
        val vm = MenuViewModel(repo)
        vm.selectCategory(null)
        assertEquals(1, repo.requestedCategoryIds.size)
    }

    @Test
    fun `a slow earlier response cannot overwrite a newer selection`() {
        val slowAll = CompletableDeferred<AppResult<List<Product>>>()
        repo.productsHandler = { id ->
            if (id == null) slowAll.await() else AppResult.Success(listOf(product(id = "c2-item")))
        }
        val vm = MenuViewModel(repo) // "All" request is now in flight

        vm.selectCategory("c2")      // user switches before it finishes
        slowAll.complete(AppResult.Success(listOf(product(id = "stale"))))

        val products = vm.state.value.products as UiState.Success
        assertEquals(listOf("c2-item"), products.data.map { it.id })
    }

    @Test
    fun `retry reloads after a failure`() {
        var calls = 0
        repo.productsHandler = {
            calls++
            if (calls == 1) AppResult.Failure(AppError.Network) else AppResult.Success(listOf(product()))
        }
        val vm = MenuViewModel(repo)
        assertTrue(vm.state.value.products is UiState.Error)

        vm.retry()

        assertTrue(vm.state.value.products is UiState.Success)
    }

    @Test
    fun `diet filter hides the other kind without another request`() {
        repo.productsHandler = {
            AppResult.Success(
                listOf(
                    product(id = "veg", dietary = DietaryType.Veg),
                    product(id = "meat", dietary = DietaryType.NonVeg),
                ),
            )
        }
        val vm = MenuViewModel(repo)

        vm.selectDiet(DietFilter.NonVeg)

        assertEquals(listOf("meat"), (vm.state.value.visibleProducts as UiState.Success).data.map { it.id })
        assertEquals(1, repo.requestedCategoryIds.size)

        vm.selectDiet(DietFilter.All)
        assertEquals(2, (vm.state.value.visibleProducts as UiState.Success).data.size)
    }

    @Test
    fun `diet filter does not turn a loading or error state into a list`() {
        repo.productsHandler = { AppResult.Failure(AppError.Network) }
        val vm = MenuViewModel(repo)

        vm.selectDiet(DietFilter.Veg)

        assertEquals(UiState.Error(AppError.Network), vm.state.value.visibleProducts)
    }

    @Test
    fun `typing does not search until submitted`() {
        val vm = MenuViewModel(repo)

        vm.onQueryChange("pep")

        assertEquals("pep", vm.state.value.query)
        assertEquals(listOf<String?>(null), repo.requestedQueries)
    }

    @Test
    fun `submitting sends the trimmed query, and clearing reloads without it`() {
        val vm = MenuViewModel(repo)

        vm.onQueryChange("  pep  ")
        vm.submitSearch()
        vm.clearSearch()

        assertEquals(listOf<String?>(null, "pep", null), repo.requestedQueries)
        assertEquals("", vm.state.value.query)
    }

    @Test
    fun `a blank query is treated as no search`() {
        val vm = MenuViewModel(repo)

        vm.onQueryChange("   ")
        vm.submitSearch()

        assertEquals(listOf<String?>(null, null), repo.requestedQueries)
    }
}
