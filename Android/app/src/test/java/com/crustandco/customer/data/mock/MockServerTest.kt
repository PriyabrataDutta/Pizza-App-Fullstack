package com.crustandco.customer.data.mock

import com.crustandco.customer.core.AppError
import com.crustandco.customer.core.AppResult
import com.crustandco.customer.core.Money
import com.crustandco.customer.domain.CheckoutItem
import com.crustandco.customer.domain.CheckoutRequest
import com.crustandco.customer.domain.NewAddress
import com.crustandco.customer.domain.OrderStatus
import com.crustandco.customer.domain.PaymentMethod
import com.crustandco.customer.domain.Quote
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

class MockServerTest {
    // Bolognese (7,50) with Spaghetti (free) + baked with cheese (1,00) = 8,50 per dish.
    private val margherita = CheckoutItem("p-141", "p-141-r", listOf("g-pasta-spaghetti-0", "g-bake-0"), 1)
    private val garlic = CheckoutItem("p-216", "p-216-r", emptyList(), 1) // Pommes, 3,00

    private fun quote(items: List<CheckoutItem>, coupon: String? = null) = MockPricing.quote(demoProducts, items, coupon)
    private fun ok(result: AppResult<Quote>) = (result as AppResult.Success).data
    private fun validation(result: AppResult<Quote>) = (result as AppResult.Failure).error as AppError.Validation

    @Test
    fun `server prices come from the catalog, never from the device`() {
        assertEquals(Money(750 + 100), ok(quote(listOf(margherita))).subtotal)
    }

    @Test
    fun `menu prices include VAT and no delivery fee is added`() {
        val q = ok(quote(listOf(margherita)))
        assertEquals(Money.ZERO, q.tax)
        assertEquals(Money.ZERO, q.deliveryFee)
        assertEquals(Money(q.subtotal.minor + q.tax.minor + q.deliveryFee.minor), q.total)
    }

    @Test
    fun `delivery stays free for bigger orders`() {
        assertEquals(Money.ZERO, ok(quote(listOf(margherita.copy(quantity = 5)))).deliveryFee)
    }

    @Test
    fun `a coupon under its minimum explains how much more to add`() {
        val error = validation(quote(listOf(garlic), "WELCOME5"))
        assertEquals("COUPON_MINIMUM", error.code)
        assertTrue(error.userMessage, error.userMessage.contains("more to use WELCOME5"))
    }

    @Test
    fun `a valid fixed coupon is taken off the subtotal`() {
        val q = ok(quote(listOf(margherita.copy(quantity = 3)), "welcome5")) // 25,50 is over the 20,00 minimum
        assertEquals(Money(500), q.discount)
        assertEquals("WELCOME5", q.couponCode)
        assertEquals(Money(2550 - 500), q.total)
    }

    @Test
    fun `a percentage coupon is capped`() {
        val q = ok(quote(listOf(margherita.copy(quantity = 12)), "feast10")) // 102,00 x 10% is 10,20, capped at 10,00
        assertEquals(Money(1000), q.discount)
        assertEquals("FEAST10", q.couponCode)
    }

    @Test
    fun `expired and unknown coupons are refused with a reason`() {
        assertEquals("COUPON_EXPIRED", validation(quote(listOf(margherita.copy(quantity = 3)), "WINTER15")).code)
        assertEquals("COUPON_INVALID", validation(quote(listOf(margherita), "NOPE")).code)
    }

    @Test
    fun `an unavailable or unknown item fails the whole quote`() {
        assertTrue(quote(listOf(margherita.copy(productId = "p-ghost"))) is AppResult.Failure)
        assertTrue(quote(listOf(margherita.copy(variantId = "nope"))) is AppResult.Failure)
        assertTrue(quote(listOf(margherita.copy(optionIds = listOf("free-pizza")))) is AppResult.Failure)
        assertTrue(quote(emptyList()) is AppResult.Failure)
    }

    @Test
    fun `quantity outside the allowed range is refused`() {
        assertTrue(quote(listOf(margherita.copy(quantity = 0))) is AppResult.Failure)
        assertTrue(quote(listOf(margherita.copy(quantity = 100))) is AppResult.Failure)
    }

    private fun request(key: String, addressId: String = "a-home", payment: PaymentMethod = PaymentMethod.CashOnDelivery) =
        CheckoutRequest(key, addressId, payment, couponCode = null, items = listOf(margherita), instructions = "Ring twice")

    @Test
    fun `placing an order creates it as Placed with the server's totals`() {
        val order = (MockBackend().place(request("k1")) as AppResult.Success).data
        assertEquals(OrderStatus.Placed, order.status)
        assertEquals(ok(quote(listOf(margherita))).total, order.total)
        assertEquals("Bolognese", order.lines.single().name)
        assertEquals("Standard", order.lines.single().variantName)
        assertEquals(listOf("Spaghetti", "Mit Käse überbacken"), order.lines.single().optionNames)
        assertTrue(order.deliveryAddress!!.contains("Hohe Straße"))
    }

    @Test
    fun `the same idempotency key returns the same order and never a second one`() {
        val backend = MockBackend()
        val before = backend.orders().size
        val first = (backend.place(request("same")) as AppResult.Success).data
        val second = (backend.place(request("same")) as AppResult.Success).data
        assertSame(first, second)
        assertEquals(before + 1, backend.orders().size)
    }

    @Test
    fun `a different key makes a new order`() {
        val backend = MockBackend()
        val first = (backend.place(request("a")) as AppResult.Success).data
        val second = (backend.place(request("b")) as AppResult.Success).data
        assertTrue(first.id != second.id)
    }

    @Test
    fun `an unknown address is refused`() {
        val failure = MockBackend().place(request("k", addressId = "a-ghost")) as AppResult.Failure
        assertEquals("ADDRESS_NOT_FOUND", (failure.error as AppError.Validation).code)
    }

    @Test
    fun `the newest active order moves through every status until delivered`() {
        val backend = MockBackend()
        val placed = (backend.place(request("adv")) as AppResult.Success).data
        val seen = mutableListOf<OrderStatus>()
        while (true) {
            val moved = backend.advanceNewestActive() ?: break
            if (moved.id != placed.id) break
            seen += moved.status
        }
        assertEquals(
            listOf(OrderStatus.Accepted, OrderStatus.Preparing, OrderStatus.ReadyForDispatch, OrderStatus.OutForDelivery, OrderStatus.Delivered),
            seen,
        )
    }

    @Test
    fun `addresses are validated before saving`() {
        val backend = MockBackend()
        val bad = backend.addAddress(NewAddress("Home", "", "Mitte", "Wesel", "4648")) as AppResult.Failure
        assertEquals("ADDRESS_INVALID", (bad.error as AppError.Validation).code)
        val good = backend.addAddress(NewAddress("Parents", "12 Hill Rd", "Mitte", "Wesel", "46483")) as AppResult.Success
        assertTrue(backend.addresses().any { it.id == good.data.id })
    }

    @Test
    fun `address validation reports each bad field`() {
        val problems = NewAddress("", "", "", "", "12ab").validate()
        assertEquals(setOf("label", "line1", "locality", "city", "postalCode"), problems.keys)
        assertTrue(NewAddress("Home", "x", "y", "Wesel", "46483").validate().isEmpty())
    }
}
