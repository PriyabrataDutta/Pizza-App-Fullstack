package com.crustandco.customer.domain

import com.crustandco.customer.core.Money
import com.crustandco.customer.data.local.InMemoryCartStore
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CartStoreTest {
    private val small = Variant("s", "Small", Money(19900), true)
    private val burst = CustomizationOption("burst", "Cheese burst", Money(6000))

    private fun item(variant: Variant = small, options: List<CustomizationOption> = emptyList(), quantity: Int = 1, product: String = "p1") =
        CartItem(product, "c1", "Margherita", variant, options, quantity)

    @Test
    fun `adding the same product size and options merges into one line`() {
        val cart = InMemoryCartStore()
        cart.add(item(quantity = 1))
        cart.add(item(quantity = 2))
        assertEquals(1, cart.items.value.size)
        assertEquals(3, cart.items.value.single().quantity)
    }

    @Test
    fun `different options make a different line`() {
        val cart = InMemoryCartStore()
        cart.add(item())
        cart.add(item(options = listOf(burst)))
        assertEquals(2, cart.items.value.size)
    }

    @Test
    fun `option order does not create a duplicate line`() {
        val a = CustomizationOption("a", "A", Money(100))
        val b = CustomizationOption("b", "B", Money(200))
        val cart = InMemoryCartStore()
        cart.add(item(options = listOf(a, b)))
        cart.add(item(options = listOf(b, a)))
        assertEquals(1, cart.items.value.size)
    }

    @Test
    fun `quantity is capped, and zero removes the line`() {
        val cart = InMemoryCartStore()
        cart.add(item(quantity = MAX_LINE_QUANTITY))
        cart.add(item(quantity = 5))
        assertEquals(MAX_LINE_QUANTITY, cart.items.value.single().quantity)

        val key = cart.items.value.single().key
        cart.setQuantity(key, 0)
        assertTrue(cart.items.value.isEmpty())
    }

    @Test
    fun `line total is unit price including options times quantity`() {
        val line = item(options = listOf(burst), quantity = 3)
        assertEquals(Money(19900 + 6000), line.unitPrice)
        assertEquals(Money((19900 + 6000) * 3), line.lineTotal)
    }

    @Test
    fun `subtotal and count add across lines`() {
        val items = listOf(item(quantity = 2), item(product = "p2", quantity = 1))
        assertEquals(3, items.itemCount())
        assertEquals(Money(19900 * 3), items.subtotal())
    }

    @Test
    fun `an empty cart has a zero subtotal`() {
        assertEquals(Money.ZERO, emptyList<CartItem>().subtotal())
    }

    @Test
    fun `clear empties the cart`() {
        val cart = InMemoryCartStore()
        cart.add(item())
        cart.clear()
        assertTrue(cart.items.value.isEmpty())
    }

    @Test
    fun `checkout items carry ids and quantity only, never a price`() {
        val checkoutItem = item(options = listOf(burst), quantity = 2).toCheckoutItem()
        assertEquals(CheckoutItem("p1", "s", listOf("burst"), 2), checkoutItem)
    }
}
