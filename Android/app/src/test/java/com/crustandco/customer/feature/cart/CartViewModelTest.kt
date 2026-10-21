package com.crustandco.customer.feature.cart

import com.crustandco.customer.FakeCatalogRepository
import com.crustandco.customer.core.UiState
import com.crustandco.customer.data.local.InMemoryCartStore
import com.crustandco.customer.data.mock.MockPricingRepository
import com.crustandco.customer.data.mock.demoProducts
import com.crustandco.customer.domain.CartItem
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class CartViewModelTest {
    private lateinit var cart: InMemoryCartStore

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        cart = InMemoryCartStore()
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun vm() = CartViewModel(cart, MockPricingRepository(latencyMs = 0), FakeCatalogRepository())

    /** Bolognese (pasta) with Spaghetti and the cheese bake = 8,50 each. */
    private fun margherita(quantity: Int): CartItem {
        val p = demoProducts.first { it.id == "p-141" }
        val options = p.customizationGroups.flatMap { it.options }.filter { it.id == "g-pasta-spaghetti-0" || it.id == "g-bake-0" }
        return CartItem(p.id, p.categoryId, p.name, p.variants.single(), options, quantity)
    }

    private fun CartViewModel.quote() = (state.value.quote as UiState.Success).data

    @Test
    fun `an empty cart has no quote to fetch`() {
        val vm = vm()
        assertTrue(vm.state.value.items.isEmpty())
    }

    @Test
    fun `the summary comes from the server quote`() {
        cart.add(margherita(1))
        val q = vm().quote()
        assertEquals(850L, q.subtotal.minor)
        assertEquals(0L, q.deliveryFee.minor)
    }

    @Test
    fun `changing the quantity re-prices the cart`() {
        val vm = vm()
        cart.add(margherita(1))
        vm.increase(cart.items.value.single())
        assertEquals(1700L, vm.quote().subtotal.minor)
        assertEquals(0L, vm.quote().deliveryFee.minor)
    }

    @Test
    fun `a valid coupon is applied and shows in the quote`() {
        cart.add(margherita(3))
        val vm = vm()
        vm.applyCoupon("welcome5")
        assertEquals("WELCOME5", vm.state.value.couponCode)
        assertEquals(500L, vm.quote().discount.minor)
        assertNull(vm.state.value.couponError)
    }

    @Test
    fun `a bad coupon explains why and applies nothing`() {
        cart.add(margherita(1))
        val vm = vm()
        vm.applyCoupon("WELCOME5") // 8,50 is under the 20,00 minimum
        assertNull(vm.state.value.couponCode)
        assertNotNull(vm.state.value.couponError)
        assertTrue(vm.state.value.couponError!!.contains("more to use WELCOME5"))
    }

    @Test
    fun `a blank code asks for one`() {
        cart.add(margherita(1))
        val vm = vm()
        vm.applyCoupon("   ")
        assertEquals("Enter a coupon code.", vm.state.value.couponError)
    }

    @Test
    fun `a coupon is dropped, with a reason, when the cart no longer qualifies`() {
        cart.add(margherita(3))
        val vm = vm()
        vm.applyCoupon("WELCOME5")
        assertEquals("WELCOME5", vm.state.value.couponCode)

        vm.decrease(cart.items.value.single()) // down to two dishes: 17,00 is under the 20,00 minimum

        assertNull(vm.state.value.couponCode)
        assertTrue(vm.state.value.couponError!!.contains("more to use WELCOME5"))
        assertEquals(0L, vm.quote().discount.minor)
    }

    @Test
    fun `removing a coupon re-prices without it`() {
        cart.add(margherita(3))
        val vm = vm()
        vm.applyCoupon("WELCOME5")
        vm.removeCoupon()
        assertNull(vm.state.value.couponCode)
        assertEquals(0L, vm.quote().discount.minor)
    }

    @Test
    fun `removing the last item empties the cart`() {
        cart.add(margherita(1))
        val vm = vm()
        vm.remove(cart.items.value.single())
        assertTrue(vm.state.value.items.isEmpty())
    }
}
