package com.crustandco.customer.feature.orders

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.crustandco.customer.core.AppResult
import com.crustandco.customer.core.UiState
import com.crustandco.customer.core.toUiState
import com.crustandco.customer.domain.Order
import com.crustandco.customer.domain.OrderRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class OrdersViewModel(private val orders: OrderRepository) : ViewModel() {
    private val _state = MutableStateFlow<UiState<List<Order>>>(UiState.Loading)
    val state: StateFlow<UiState<List<Order>>> = _state.asStateFlow()

    init {
        load()
    }

    fun retry() = load()

    private fun load() {
        _state.value = UiState.Loading
        viewModelScope.launch {
            // Status shown is always the persisted backend status. Nothing here guesses or simulates progress.
            _state.value = orders.orders().toUiState()
        }
    }

    /** Reloads in the background. The list stays on screen while it loads, and an error never replaces good data. */
    fun refresh() {
        viewModelScope.launch {
            val result = orders.orders()
            if (result is AppResult.Success) _state.value = UiState.Success(result.data)
            else if (_state.value !is UiState.Success) _state.value = result.toUiState()
        }
    }
}
