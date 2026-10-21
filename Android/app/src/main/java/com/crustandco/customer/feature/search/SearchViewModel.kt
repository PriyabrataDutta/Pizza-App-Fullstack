package com.crustandco.customer.feature.search

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.crustandco.customer.core.AppResult
import com.crustandco.customer.core.UiState
import com.crustandco.customer.core.toUiState
import com.crustandco.customer.domain.CartStore
import com.crustandco.customer.domain.CatalogRepository
import com.crustandco.customer.domain.Category
import com.crustandco.customer.domain.Product
import com.crustandco.customer.domain.quickAddItem
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** How long typing must pause before a search is sent, so each keystroke doesn't hit the server. */
private const val DEBOUNCE_MS = 300L
private const val MIN_QUERY_LENGTH = 2

data class SearchState(
    val query: String = "",
    val categories: List<Category> = emptyList(),
    /** Null until the customer has typed enough to search. */
    val results: UiState<List<Product>>? = null,
)

class SearchViewModel(
    private val catalog: CatalogRepository,
    private val cart: CartStore,
) : ViewModel() {
    private val _state = MutableStateFlow(SearchState())
    val state: StateFlow<SearchState> = _state.asStateFlow()

    private var searchJob: Job? = null

    init {
        viewModelScope.launch {
            val result = catalog.categories()
            if (result is AppResult.Success) _state.update { it.copy(categories = result.data) }
        }
    }

    fun onQueryChange(query: String) {
        _state.update { it.copy(query = query) }
        search(debounce = true)
    }

    fun submit() = search(debounce = false)

    fun clear() {
        searchJob?.cancel()
        _state.update { it.copy(query = "", results = null) }
    }

    fun retry() = search(debounce = false)

    /** True if the item went straight into the cart. False means the customer must choose a size or options first. */
    fun quickAdd(product: Product): Boolean {
        val item = product.quickAddItem() ?: return false
        cart.add(item)
        return true
    }

    private fun search(debounce: Boolean) {
        // A newer keystroke or a submit replaces any search still waiting or in flight.
        searchJob?.cancel()
        val query = _state.value.query.trim()
        if (query.length < MIN_QUERY_LENGTH) {
            _state.update { it.copy(results = null) }
            return
        }
        searchJob = viewModelScope.launch {
            if (debounce) delay(DEBOUNCE_MS)
            _state.update { it.copy(results = UiState.Loading) }
            val result = catalog.products(search = query).toUiState()
            _state.update { it.copy(results = result) }
        }
    }
}
