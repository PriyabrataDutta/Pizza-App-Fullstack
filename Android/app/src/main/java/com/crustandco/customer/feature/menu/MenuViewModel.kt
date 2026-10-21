package com.crustandco.customer.feature.menu

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.crustandco.customer.core.AppResult
import com.crustandco.customer.core.UiState
import com.crustandco.customer.core.toUiState
import com.crustandco.customer.domain.CartStore
import com.crustandco.customer.domain.CatalogRepository
import com.crustandco.customer.domain.Category
import com.crustandco.customer.domain.DietaryType
import com.crustandco.customer.domain.Product
import com.crustandco.customer.domain.Promotion
import com.crustandco.customer.domain.PromotionRepository
import com.crustandco.customer.domain.quickAddItem
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class DietFilter(val label: String) {
    All("All"),
    Veg("Veg"),
    NonVeg("Non-veg"),

    /** Uses the catalog's is_spicy flag. */
    Spicy("Spicy");

    fun matches(product: Product): Boolean = when (this) {
        All -> true
        Veg -> product.dietaryType == DietaryType.Veg
        NonVeg -> product.dietaryType == DietaryType.NonVeg
        Spicy -> product.isSpicy
    }
}

data class MenuState(
    val categories: List<Category> = emptyList(),
    /** Null means "All". */
    val selectedCategoryId: String? = null,
    /** The Deals tab shows promotions instead of products. */
    val dealsSelected: Boolean = false,
    val promotions: List<Promotion> = emptyList(),
    /** Text in the search box. Only sent to the server when submitted. */
    val query: String = "",
    val diet: DietFilter = DietFilter.All,
    /** What the server returned for the current category and search, before the diet filter. */
    val products: UiState<List<Product>> = UiState.Loading,
) {
    /** Diet is filtered on the device: the contract defines no diet query parameter, so none is invented. */
    val visibleProducts: UiState<List<Product>>
        get() = when (val p = products) {
            is UiState.Success -> UiState.Success(p.data.filter { diet.matches(it) })
            else -> p
        }
}

class MenuViewModel(
    private val catalog: CatalogRepository,
    private val promotions: PromotionRepository,
    private val cart: CartStore,
) : ViewModel() {
    private val _state = MutableStateFlow(MenuState())
    val state: StateFlow<MenuState> = _state.asStateFlow()

    private var productsJob: Job? = null

    init {
        loadSecondary()
        loadProducts()
    }

    fun retry() {
        loadSecondary()
        loadProducts()
    }

    fun selectCategory(categoryId: String?) {
        val current = _state.value
        if (categoryId == current.selectedCategoryId && !current.dealsSelected) return
        _state.update { it.copy(selectedCategoryId = categoryId, dealsSelected = false) }
        loadProducts()
    }

    fun selectDeals() {
        _state.update { it.copy(dealsSelected = true) }
    }

    fun selectDiet(diet: DietFilter) {
        _state.update { it.copy(diet = diet) }
    }

    fun onQueryChange(query: String) {
        _state.update { it.copy(query = query) }
    }

    fun submitSearch() {
        _state.update { it.copy(dealsSelected = false) }
        loadProducts()
    }

    fun clearSearch() {
        if (_state.value.query.isEmpty()) return
        _state.update { it.copy(query = "") }
        loadProducts()
    }

    /** True if the item went straight into the cart. False means the customer must choose a size or options first. */
    fun quickAdd(product: Product): Boolean {
        val item = product.quickAddItem() ?: return false
        cart.add(item)
        return true
    }

    private fun loadSecondary() {
        // Categories and promotions are optional: if they fail the products still show, so their errors aren't surfaced.
        viewModelScope.launch {
            val result = catalog.categories()
            if (result is AppResult.Success) _state.update { it.copy(categories = result.data) }
        }
        viewModelScope.launch {
            val result = promotions.promotions()
            if (result is AppResult.Success) _state.update { it.copy(promotions = result.data) }
        }
    }

    private fun loadProducts() {
        // Cancel any in-flight request so a slow earlier response can't overwrite a newer selection.
        productsJob?.cancel()
        _state.update { it.copy(products = UiState.Loading) }
        val current = _state.value
        productsJob = viewModelScope.launch {
            val result = catalog.products(categoryId = current.selectedCategoryId, search = current.query.trim().ifEmpty { null }).toUiState()
            _state.update { it.copy(products = result) }
        }
    }
}
