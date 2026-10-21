package com.crustandco.customer.domain

import com.crustandco.customer.core.Money
import kotlinx.coroutines.flow.StateFlow

/** Largest quantity of a single cart line. A UI guard, not a business rule from the spec; the server decides what's allowed. */
const val MAX_LINE_QUANTITY = 20

/**
 * One line in the cart. Prices are a snapshot from when the item was added and are INDICATIVE.
 * At checkout the server recalculates everything from the IDs; the app never sends a total.
 */
data class CartItem(
    val productId: String,
    val categoryId: String,
    val productName: String,
    val variant: Variant,
    val options: List<CustomizationOption>,
    val quantity: Int,
) {
    /** Same product + size + options means the same line, so adding it again increases the quantity. */
    val key: String = "$productId|${variant.id}|${options.map { it.id }.sorted().joinToString(",")}"

    val unitPrice: Money get() = options.fold(variant.price) { total, option -> total + option.priceFor(variant.id) }
    val lineTotal: Money get() = unitPrice * quantity
}

fun List<CartItem>.itemCount(): Int = sumOf { it.quantity }

fun List<CartItem>.subtotal(): Money = fold(Money.ZERO) { total, item -> total + item.lineTotal }

/** In-memory cart. Phase 2 keeps it simple; saving it across app restarts is a later step. */
interface CartStore {
    val items: StateFlow<List<CartItem>>

    /** Adds the item, or merges into an existing identical line. */
    fun add(item: CartItem)

    /** Sets a line's quantity. Zero or less removes it; above [MAX_LINE_QUANTITY] is capped. */
    fun setQuantity(key: String, quantity: Int)

    fun remove(key: String)

    fun clear()
}
