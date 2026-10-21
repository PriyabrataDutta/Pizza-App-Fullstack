package com.crustandco.customer.feature.checkout

import com.crustandco.customer.core.AppError
import com.crustandco.customer.core.AppResult
import com.crustandco.customer.core.Money
import com.crustandco.customer.core.UiState
import com.crustandco.customer.data.local.InMemoryCartStore
import com.crustandco.customer.data.mock.MockPricingRepository
import com.crustandco.customer.data.mock.demoProducts
import com.crustandco.customer.domain.Address
import com.crustandco.customer.domain.AddressRepository
import com.crustandco.customer.domain.CartItem
import com.crustandco.customer.domain.CheckoutRepository
import com.crustandco.customer.domain.CheckoutRequest
import com.crustandco.customer.domain.NewAddress
import com.crustandco.customer.domain.Order
import com.crustandco.customer.domain.OrderStatus
import com.crustandco.customer.domain.PaymentMethod
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

private class FakeAddresses : AddressRepository {
    val list = mutableListOf(
        Address("home", "Home", "Hohe Straße 12", "Wesel-Mitte", "Wesel", "46483"),
        Address("office", "Office", "Kaiserring 8", "Feldmark", "Wesel", "46485"),
    )

    override suspend fun addresses() = AppResult.Success(list.toList())

    override suspend fun add(address: NewAddress): AppResult<Address> {
        val saved = Address("new-${list.size}", address.label, address.line1, address.locality, address.city, address.postalCode)
        list += saved
        return AppResult.Success(saved)
    }
}

/** Records every request, and lets a test hold the response open to simulate a slow network. */
private class FakeCheckout : CheckoutRepository {
    val requests = mutableListOf<CheckoutRequest>()
    var gate: CompletableDeferred<Unit>? = null
    var failWith: AppError? = null

    override suspend fun placeOrder(request: CheckoutRequest): AppResult<Order> {
        requests += request
        gate?.await()
        failWith?.let { return AppResult.Failure(it) }
        return AppResult.Success(
            Order("o-${requests.size}", "CC-${1048 + requests.size}", OrderStatus.Placed, Money(36000), "2026-10-16T19:42:00+02:00"),
        )
    }
}

@OptIn(ExperimentalCoroutinesApi::class)
class CheckoutViewModelTest {
    private lateinit var cart: InMemoryCartStore
    private lateinit var checkout: FakeCheckout
    private var keyCounter = 0

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        cart = InMemoryCartStore()
        checkout = FakeCheckout()
        keyCounter = 0
        val p = demoProducts.first { it.id == "p-141" }
        val options = p.customizationGroups.flatMap { it.options }.filter { it.id == "g-pasta-spaghetti-0" }
        cart.add(CartItem(p.id, p.categoryId, p.name, p.variants.single(), options, 1))
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun vm(couponCode: String? = null, addresses: FakeAddresses = FakeAddresses()) =
        CheckoutViewModel(couponCode, cart, addresses, MockPricingRepository(latencyMs = 0), checkout, newKey = { "key-${++keyCounter}" })

    @Test
    fun `the first address is selected and the server quote loads`() {
        val vm = vm()
        assertEquals("home", vm.state.value.selectedAddressId)
        assertTrue(vm.state.value.quote is UiState.Success)
    }

    @Test
    fun `continue moves to payment, and back returns to the address step`() {
        val vm = vm()
        vm.continueToPayment()
        assertEquals(CheckoutStep.Payment, vm.state.value.step)
        assertTrue(vm.back())
        assertEquals(CheckoutStep.Address, vm.state.value.step)
        assertTrue(!vm.back()) // already at the first step: the screen should leave
    }

    @Test
    fun `placing an order clears the cart and finishes`() {
        val vm = vm()
        vm.continueToPayment()
        vm.placeOrder()
        assertEquals(CheckoutStep.Done, vm.state.value.step)
        assertNotNull(vm.state.value.placedOrder)
        assertTrue(cart.items.value.isEmpty())
    }

    @Test
    fun `the request carries ids and choices, and no totals`() {
        val vm = vm(couponCode = "PIZZA2")
        vm.setInstructions("  Ring twice  ")
        vm.selectPayment(PaymentMethod.OnlineDemo)
        vm.continueToPayment()
        vm.placeOrder()

        val request = checkout.requests.single()
        assertEquals("home", request.addressId)
        assertEquals(PaymentMethod.OnlineDemo, request.paymentMethod)
        assertEquals("PIZZA2", request.couponCode)
        assertEquals("Ring twice", request.instructions)
        assertEquals("p-141", request.items.single().productId)
        assertEquals(listOf("g-pasta-spaghetti-0"), request.items.single().optionIds)
    }

    @Test
    fun `a second tap while the order is in flight sends nothing`() {
        checkout.gate = CompletableDeferred()
        val vm = vm()
        vm.continueToPayment()

        vm.placeOrder()
        vm.placeOrder()
        vm.placeOrder()

        assertTrue(vm.state.value.placing)
        assertEquals(1, checkout.requests.size)

        checkout.gate!!.complete(Unit)
        assertEquals(1, checkout.requests.size)
        assertNotNull(vm.state.value.placedOrder)
    }

    @Test
    fun `a failed order keeps the cart and shows why`() {
        checkout.failWith = AppError.Network
        val vm = vm()
        vm.continueToPayment()
        vm.placeOrder()

        assertEquals(CheckoutStep.Payment, vm.state.value.step)
        assertEquals(AppError.Network.userMessage, vm.state.value.placeError)
        assertTrue(cart.items.value.isNotEmpty())
        assertTrue(!vm.state.value.placing)
    }

    @Test
    fun `retrying the same order reuses the idempotency key`() {
        checkout.failWith = AppError.Network
        val vm = vm()
        vm.continueToPayment()
        vm.placeOrder()
        checkout.failWith = null
        vm.placeOrder()

        assertEquals(2, checkout.requests.size)
        assertEquals(checkout.requests[0].idempotencyKey, checkout.requests[1].idempotencyKey)
    }

    @Test
    fun `changing the order starts a new idempotency key`() {
        checkout.failWith = AppError.Server
        val vm = vm()
        vm.continueToPayment()
        vm.placeOrder()
        vm.selectPayment(PaymentMethod.OnlineDemo)
        checkout.failWith = null
        vm.placeOrder()

        assertNotEquals(checkout.requests[0].idempotencyKey, checkout.requests[1].idempotencyKey)
    }

    @Test
    fun `an order that was placed cannot be placed again`() {
        val vm = vm()
        vm.continueToPayment()
        vm.placeOrder()
        vm.placeOrder()
        assertEquals(1, checkout.requests.size)
    }

    @Test
    fun `adding an address selects it`() {
        val vm = vm()
        var saved = false
        vm.addAddress(NewAddress("Parents", "12 Hill Rd", "Mitte", "Wesel", "46483")) { saved = true }
        assertTrue(saved)
        assertTrue(vm.state.value.selectedAddressId!!.startsWith("new-"))
    }

    @Test
    fun `cannot continue without an address`() {
        val addresses = FakeAddresses().apply { list.clear() }
        val vm = vm(addresses = addresses)
        vm.continueToPayment()
        assertEquals(CheckoutStep.Address, vm.state.value.step)
    }
}
