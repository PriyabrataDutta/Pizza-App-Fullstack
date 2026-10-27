package com.crustandco.customer.domain

import com.crustandco.customer.core.Money

// Domain models. Independent of Compose, Retrofit and DTOs. The data layer maps DTOs into these.

data class Category(
    val id: String,
    val name: String,
    val imageUrl: String?,
    /** Small copy for lists and chips; null when the server has none. */
    val thumbUrl: String? = null,
)

enum class DietaryType { Veg, NonVeg }

data class Variant(
    val id: String,
    val name: String,
    val price: Money,
    val isAvailable: Boolean,
)

data class CustomizationOption(
    val id: String,
    val name: String,
    /** Flat extra charge for this option, used when [prices] has no entry for the chosen size. Zero when included. */
    val priceDelta: Money,
    /** Extra charge per size (variant id), for extras that cost more on a bigger portion, like a pizza topping. */
    val prices: Map<String, Money> = emptyMap(),
    /** The option preselected for this product (for example the pasta a dish comes with). */
    val isDefault: Boolean = false,
) {
    /** What this option adds for the given size. */
    fun priceFor(variantId: String?): Money = (variantId?.let { prices[it] }) ?: priceDelta
}

data class CustomizationGroup(
    val id: String,
    val name: String,
    val isRequired: Boolean,
    val minSelections: Int,
    val maxSelections: Int,
    val options: List<CustomizationOption>,
)

data class Product(
    val id: String,
    val categoryId: String,
    val name: String,
    val description: String,
    val imageUrl: String?,
    val dietaryType: DietaryType,
    val isSpicy: Boolean,
    val isBestseller: Boolean,
    val variants: List<Variant>,
    val customizationGroups: List<CustomizationGroup>,
    /**
     * True when a required choice must be made first. List responses leave [customizationGroups] empty, so the server says
     * this directly; without it the "+" on a card would add a pasta dish with no pasta chosen.
     */
    val needsChoices: Boolean = false,
    /** Small copy for cards and lists (about 35 KB); [imageUrl] is the full picture for the product screen. */
    val thumbUrl: String? = null,
) {
    private val availableVariants get() = variants.filter { it.isAvailable }

    /** Lowest price among available sizes, for "From 7,50 €" labels. Null when nothing is available. */
    val startingPrice: Money? get() = availableVariants.minByOrNull { it.price.minor }?.price

    val hasMultipleSizes: Boolean get() = availableVariants.size > 1
    val isAvailable: Boolean get() = availableVariants.isNotEmpty()
}

/** Canonical order lifecycle from docs/order-lifecycle.md. [Unknown] keeps the app alive if the backend adds a status. */
enum class OrderStatus(val wire: String?, val label: String) {
    Placed("placed", "Placed"),
    Accepted("accepted", "Accepted"),
    Preparing("preparing", "Preparing"),
    ReadyForDispatch("ready_for_dispatch", "Ready for dispatch"),
    OutForDelivery("out_for_delivery", "Out for delivery"),
    Delivered("delivered", "Delivered"),
    Rejected("rejected", "Rejected"),
    Cancelled("cancelled", "Cancelled"),
    Unknown(null, "Status unavailable");

    companion object {
        fun fromWire(value: String?): OrderStatus = entries.firstOrNull { it.wire != null && it.wire == value } ?: Unknown
    }
}

/** One line of a placed order, as a snapshot. Names and prices don't change if the menu is edited later. */
data class OrderLine(
    val name: String,
    val variantName: String,
    val optionNames: List<String>,
    val quantity: Int,
    val lineTotal: Money,
)

enum class PaymentMethod(val wire: String, val label: String) {
    CashOnDelivery("cod", "Cash on delivery"),

    /** Simulated. No card details are ever collected and no money moves (docs/security-and-rls.md). Kept so old orders still read. */
    OnlineDemo("online_demo", "Online payment (demo)"),
    ;

    companion object {
        /** What a customer can choose today. Online payment comes back when a real payment provider is connected. */
        val selectable: List<PaymentMethod> = listOf(CashOnDelivery)
    }
}

data class Order(
    val id: String,
    /** Human-readable number, e.g. CC-1048. */
    val number: String,
    val status: OrderStatus,
    val total: Money,
    /** ISO 8601 timestamp from the server, kept as text until a screen needs to format it. */
    val createdAt: String,
    val lines: List<OrderLine> = emptyList(),
    val subtotal: Money? = null,
    val discount: Money? = null,
    val tax: Money? = null,
    val deliveryFee: Money? = null,
    val deliveryAddress: String? = null,
    val paymentMethod: PaymentMethod? = null,
    /** Server's delivery estimate for this order's zone. Shown as an estimate, never as a live countdown. */
    val estimatedMinutes: Int? = null,
) {
    /** Active orders are the ones still moving through the kitchen or out for delivery. */
    val isActive: Boolean
        get() = status != OrderStatus.Delivered && status != OrderStatus.Rejected && status != OrderStatus.Cancelled
}

/** 0 = Confirmed, 1 = Preparing, 2 = On the way, 3 = Delivered. Null for orders that won't be delivered. */
val OrderStatus.trackerStep: Int?
    get() = when (this) {
        OrderStatus.Placed, OrderStatus.Accepted -> 0
        OrderStatus.Preparing, OrderStatus.ReadyForDispatch -> 1
        OrderStatus.OutForDelivery -> 2
        OrderStatus.Delivered -> 3
        OrderStatus.Rejected, OrderStatus.Cancelled, OrderStatus.Unknown -> null
    }

/** Marketing banner shown on Home. [code] is the coupon to enter at checkout; the server still validates it. */
data class Promotion(
    val id: String,
    val title: String,
    val detail: String,
    val code: String?,
)
