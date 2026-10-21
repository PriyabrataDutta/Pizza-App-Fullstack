package com.crustandco.customer.data.mock

import com.crustandco.customer.core.AppError
import com.crustandco.customer.core.AppResult
import com.crustandco.customer.core.Money
import com.crustandco.customer.domain.Address
import com.crustandco.customer.domain.CheckoutRequest
import com.crustandco.customer.domain.NewAddress
import com.crustandco.customer.domain.Order
import com.crustandco.customer.domain.OrderLine
import com.crustandco.customer.domain.OrderStatus
import com.crustandco.customer.domain.Product
import java.time.OffsetDateTime

/**
 * In-memory stand-in for the backend's state: addresses and orders, with idempotent order placement.
 * Only used in demo mode. Everything resets when the app process ends, like the demo seed.
 */
internal class MockBackend {
    private val lock = Any()
    private val addresses = demoAddresses.toMutableList()
    private val orders = demoOrders().toMutableList() // newest first
    private val orderByKey = mutableMapOf<String, Order>()
    private var nextNumber = 1049

    fun addresses(): List<Address> = synchronized(lock) { addresses.toList() }

    fun addAddress(new: NewAddress): AppResult<Address> {
        val problems = new.validate()
        if (problems.isNotEmpty()) return AppResult.Failure(AppError.Validation("ADDRESS_INVALID", problems.values.first()))
        return synchronized(lock) {
            val address = Address("a-${addresses.size + 1}-${new.postalCode}", new.label.trim(), new.line1.trim(), new.locality.trim(), new.city.trim(), new.postalCode)
            addresses += address
            AppResult.Success(address)
        }
    }

    fun orders(): List<Order> = synchronized(lock) { orders.toList() }

    fun order(id: String): Order? = synchronized(lock) { orders.firstOrNull { it.id == id } }

    /** Same idempotency key returns the same order, so retries and double taps never create a second one. */
    fun place(request: CheckoutRequest, products: List<Product> = demoProducts): AppResult<Order> = synchronized(lock) {
        orderByKey[request.idempotencyKey]?.let { return AppResult.Success(it) }

        val address = addresses.firstOrNull { it.id == request.addressId }
            ?: return AppResult.Failure(AppError.Validation("ADDRESS_NOT_FOUND", "Pick a delivery address and try again."))
        val quote = when (val result = MockPricing.quote(products, request.items, request.couponCode)) {
            is AppResult.Failure -> return result
            is AppResult.Success -> result.data
        }

        val lines = request.items.map { item ->
            val product = products.first { it.id == item.productId }
            val variant = product.variants.first { it.id == item.variantId }
            val optionNames = item.optionIds.mapNotNull { id -> product.customizationGroups.flatMap { it.options }.firstOrNull { it.id == id }?.name }
            OrderLine(product.name, variant.name, optionNames, item.quantity, MockPricing.lineTotal(products, item) ?: Money.ZERO)
        }
        val number = nextNumber++
        val order = Order(
            id = "o-$number", number = "CC-$number", status = OrderStatus.Placed, total = quote.total,
            createdAt = OffsetDateTime.now().toString(), lines = lines, subtotal = quote.subtotal, discount = quote.discount,
            tax = quote.tax, deliveryFee = quote.deliveryFee, deliveryAddress = address.oneLine,
            paymentMethod = request.paymentMethod, estimatedMinutes = MockPricing.ESTIMATED_MINUTES,
        )
        orders.add(0, order)
        orderByKey[request.idempotencyKey] = order
        AppResult.Success(order)
    }

    /** Demo only: stands in for the restaurant moving the newest active order along (the dashboard does this for real). */
    fun advanceNewestActive(): Order? = synchronized(lock) {
        val index = orders.indexOfFirst { it.isActive }
        if (index < 0) return null
        val next = when (orders[index].status) {
            OrderStatus.Placed -> OrderStatus.Accepted
            OrderStatus.Accepted -> OrderStatus.Preparing
            OrderStatus.Preparing -> OrderStatus.ReadyForDispatch
            OrderStatus.ReadyForDispatch -> OrderStatus.OutForDelivery
            OrderStatus.OutForDelivery -> OrderStatus.Delivered
            else -> return null
        }
        orders[index] = orders[index].copy(status = next)
        orders[index]
    }
}
