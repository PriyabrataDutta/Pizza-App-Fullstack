package com.crustandco.customer.data.mock

import com.crustandco.customer.core.Money
import com.crustandco.customer.domain.Address
import com.crustandco.customer.domain.Order
import com.crustandco.customer.domain.OrderLine
import com.crustandco.customer.domain.OrderStatus
import com.crustandco.customer.domain.PaymentMethod
import com.crustandco.customer.domain.Promotion

// DEMO DATA ONLY: orders, addresses and offers. The menu itself is in MockMenu.kt. Used when BuildConfig.USE_MOCK_DATA is true.
// Kept apart from the repositories so it is obvious what to delete when the real API takes over.

private const val HOME_ADDRESS = "Hohe Straße 12, Wesel-Mitte, 46483 Wesel"

private fun demoOrder(
    id: String, number: String, status: OrderStatus, createdAt: String, lines: List<OrderLine>, payment: PaymentMethod = PaymentMethod.CashOnDelivery,
): Order {
    val subtotal = lines.fold(Money.ZERO) { total, line -> total + line.lineTotal }
    val tax = Money.ZERO
    val delivery = Money.ZERO
    return Order(
        id = id, number = number, status = status, total = Money(subtotal.minor + tax.minor + delivery.minor), createdAt = createdAt,
        lines = lines, subtotal = subtotal, discount = Money.ZERO, tax = tax, deliveryFee = delivery,
        deliveryAddress = HOME_ADDRESS, paymentMethod = payment, estimatedMinutes = 30,
    )
}

internal fun demoOrders(): List<Order> = listOf(
    demoOrder(
        "o-1", "CC-1048", OrderStatus.OutForDelivery, "2026-10-16T19:42:00+02:00",
        listOf(
            OrderLine("Salami", "Groß 32 cm", emptyList(), 1, euros(900)),
            OrderLine("Softdrinks", "1,0 l", listOf("Coca-Cola"), 1, euros(250)),
        ),
    ),
    demoOrder(
        "o-2", "CC-1031", OrderStatus.Delivered, "2026-10-12T20:05:00+02:00",
        listOf(
            OrderLine("Gyros Niki", "Standard", emptyList(), 1, euros(1150)),
            OrderLine("Margherita", "Klein 28 cm", emptyList(), 2, euros(1100)),
        ),
        PaymentMethod.OnlineDemo,
    ),
    demoOrder(
        "o-3", "CC-1019", OrderStatus.Cancelled, "2026-10-08T13:20:00+02:00",
        listOf(OrderLine("Chicken Curry", "Standard", listOf("Basmati-Reis"), 1, euros(1200))),
    ),
)

internal val demoAddresses = listOf(
    Address("a-home", "Home", "Hohe Straße 12", "Wesel-Mitte", "Wesel", "46483"),
    Address("a-office", "Office", "Kaiserring 8", "Feldmark", "Wesel", "46485"),
)

/** The offers printed on the menu, shown as banners. They can't be ordered as bundles in the app, so Order now opens the menu. */
internal val demoPromotions = listOf(
    Promotion(
        id = "promo-angebot-1",
        title = "Angebot 1 · 25 €",
        detail = "2 große Pizzen oder 2 Nudelgerichte, kleiner Salat, Pizzabrötchen und 1 l Getränk.",
        code = null,
    ),
    Promotion(
        id = "promo-angebot-2",
        title = "Angebot 2 · 42 €",
        detail = "4 große Pizzen, großer Salat, Pizzabrötchen und 1 l Getränk.",
        code = null,
    ),
    Promotion(
        id = "promo-pizzablech",
        title = "Pizzablech ab 24 €",
        detail = "60 x 40 cm: Margherita 24 €, mit 2 Zutaten 28 €.",
        code = null,
    ),
    Promotion(
        id = "promo-getraenk-gratis",
        title = "1 l Getränk gratis",
        detail = "Ab 30 € Bestellwert gibt es ein alkoholfreies Getränk (1 l) dazu.",
        code = null,
    ),
)
