package com.crustandco.customer.feature.addresses

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.crustandco.customer.core.AppResult
import com.crustandco.customer.core.UiState
import com.crustandco.customer.core.toUiState
import com.crustandco.customer.domain.Address
import com.crustandco.customer.domain.AddressRepository
import com.crustandco.customer.domain.NewAddress
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class AddressesState(
    val addresses: UiState<List<Address>> = UiState.Loading,
    val saving: Boolean = false,
    /** Server-side reason an address was rejected. Field-level checks happen in the form before this. */
    val saveError: String? = null,
)

class AddressesViewModel(private val repository: AddressRepository) : ViewModel() {
    private val _state = MutableStateFlow(AddressesState())
    val state: StateFlow<AddressesState> = _state.asStateFlow()

    init {
        load()
    }

    fun retry() = load()

    private fun load() {
        _state.update { it.copy(addresses = UiState.Loading) }
        viewModelScope.launch {
            val result = repository.addresses().toUiState()
            _state.update { it.copy(addresses = result) }
        }
    }

    /** Calls [onSaved] with the new address after the server accepted it. */
    fun add(address: NewAddress, onSaved: (Address) -> Unit = {}) {
        if (_state.value.saving) return
        _state.update { it.copy(saving = true, saveError = null) }
        viewModelScope.launch {
            when (val result = repository.add(address)) {
                is AppResult.Success -> {
                    val reloaded = repository.addresses().toUiState()
                    _state.update { it.copy(saving = false, addresses = reloaded) }
                    onSaved(result.data)
                }
                is AppResult.Failure -> _state.update { it.copy(saving = false, saveError = result.error.userMessage) }
            }
        }
    }

    fun clearSaveError() = _state.update { it.copy(saveError = null) }
}
