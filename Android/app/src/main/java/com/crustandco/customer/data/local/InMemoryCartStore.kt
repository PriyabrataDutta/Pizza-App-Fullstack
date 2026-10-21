package com.crustandco.customer.data.local

import com.crustandco.customer.domain.CartItem
import com.crustandco.customer.domain.CartStore
import com.crustandco.customer.domain.MAX_LINE_QUANTITY
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

class InMemoryCartStore : CartStore {
    private val _items = MutableStateFlow<List<CartItem>>(emptyList())
    override val items: StateFlow<List<CartItem>> = _items.asStateFlow()

    override fun add(item: CartItem) {
        _items.update { current ->
            val existing = current.firstOrNull { it.key == item.key }
            if (existing == null) {
                current + item.copy(quantity = item.quantity.coerceIn(1, MAX_LINE_QUANTITY))
            } else {
                current.map { if (it.key == item.key) it.copy(quantity = (it.quantity + item.quantity).coerceAtMost(MAX_LINE_QUANTITY)) else it }
            }
        }
    }

    override fun setQuantity(key: String, quantity: Int) {
        _items.update { current ->
            if (quantity <= 0) current.filterNot { it.key == key }
            else current.map { if (it.key == key) it.copy(quantity = quantity.coerceAtMost(MAX_LINE_QUANTITY)) else it }
        }
    }

    override fun remove(key: String) {
        _items.update { current -> current.filterNot { it.key == key } }
    }

    override fun clear() {
        _items.value = emptyList()
    }
}
