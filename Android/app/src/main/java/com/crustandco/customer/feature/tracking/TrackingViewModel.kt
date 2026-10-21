package com.crustandco.customer.feature.tracking

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

class TrackingViewModel(private val orderId: String, private val orders: OrderRepository) : ViewModel() {
    private val _state = MutableStateFlow<UiState<Order>>(UiState.Loading)
    val state: StateFlow<UiState<Order>> = _state.asStateFlow()

    init {
        load()
    }

    fun retry() = load()

    private fun load() {
        _state.value = UiState.Loading
        viewModelScope.launch { _state.value = orders.order(orderId).toUiState() }
    }

    /** Re-reads the persisted order. Keeps showing the last good status if the refresh fails (flaky network). */
    fun refresh() {
        viewModelScope.launch {
            val result = orders.order(orderId)
            if (result is AppResult.Success) _state.value = UiState.Success(result.data)
        }
    }
}
