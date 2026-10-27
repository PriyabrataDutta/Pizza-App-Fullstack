package com.crustandco.customer.domain

import com.crustandco.customer.core.AppResult
import com.crustandco.customer.core.Money

// Addresses, pricing and checkout. The device only ever sends IDs and quantities.
// The server decides every price, discount, tax and fee (docs/security-and-rls.md "Trusted checkout").

data class Address(
    val id: String,
    /** "Home", "Office"... */
    val label: String,
    val line1: String,
    val locality: String,
    val city: String,
    val postalCode: String,
) {
    val oneLine: String get() = listOf(line1, locality, "$city $postalCode".trim()).filter { it.isNotBlank() }.joinToString(", ")
}

data class NewAddress(
    val label: String,
    val line1: String,
    val locality: String,
    val city: String,
    val postalCode: String,
) {
    /** Field name to message. Empty when valid. The server validates again. */
    fun validate(): Map<String, String> = buildMap {
        if (label.isBlank()) put("label", "Give this address a name, like Home or Office.")
        if (line1.isBlank()) put("line1", "Enter the flat, building or street.")
        if (locality.isBlank()) put("locality", "Enter the area or locality.")
        if (city.isBlank()) put("city", "Enter the city.")
        if (!postalCode.matches(Regex("""\d{5}"""))) put("postalCode", "Enter a 5-digit postcode (PLZ).")
    }
}

interface AddressRepository {
    suspend fun addresses(): AppResult<List<Address>>
    suspend fun add(address: NewAddress): AppResult<Address>
}

/** A cart line as the server needs it: IDs and quantity only. No prices. */
data class CheckoutItem(
    val productId: String,
    val variantId: String,
    val optionIds: List<String>,
    val quantity: Int,
)

fun CartItem.toCheckoutItem() = CheckoutItem(
    productId = productId,
    variantId = variant.id,
    optionIds = options.map { it.id },
    quantity = quantity,
)

/** The server's price breakdown for a cart. Everything here is authoritative. */
data class Quote(
    val subtotal: Money,
    val discount: Money,
    val tax: Money,
    val deliveryFee: Money,
    val total: Money,
    /** The coupon that was applied, or null. */
    val couponCode: String?,
    /** False while the restaurant is closed or has switched ordering off; [closedMessage] says why. */
    val restaurantOpen: Boolean = true,
    val closedMessage: String = "",
)

interface PricingRepository {
    /**
     * Prices the cart. A coupon that can't be used fails with [com.crustandco.customer.core.AppError.Validation]
     * carrying a message that says why, so the screen can show it.
     */
    suspend fun quote(items: List<CheckoutItem>, couponCode: String?): AppResult<Quote>
}

data class CheckoutRequest(
    /** Generated once per checkout attempt and reused on retry, so a double tap or flaky network can't create two orders. */
    val idempotencyKey: String,
    val addressId: String,
    val paymentMethod: PaymentMethod,
    val couponCode: String?,
    val items: List<CheckoutItem>,
    val instructions: String?,
    /** Who the driver calls. */
    val contactName: String? = null,
    val contactPhone: String? = null,
)

interface CheckoutRepository {
    suspend fun placeOrder(request: CheckoutRequest): AppResult<Order>
}
