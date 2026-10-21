package com.crustandco.customer.core

import java.math.BigDecimal
import java.text.NumberFormat
import java.util.Currency
import java.util.Locale

/**
 * Money as integer minor units (cents) plus an ISO currency code. Never use Float/Double for money.
 * Amounts shown to the user are indicative until the server confirms them at checkout.
 */
data class Money(val minor: Long, val currency: String = DEFAULT_CURRENCY) {

    operator fun plus(other: Money): Money {
        require(currency == other.currency) { "Cannot add $currency and ${other.currency}" }
        return Money(minor + other.minor, currency)
    }

    operator fun times(quantity: Int): Money = Money(minor * quantity, currency)

    /** "7,50 €" for euros in German style, always with cents (other currencies use the same layout). Display only. */
    fun format(locale: Locale = GERMANY): String {
        val formatter = NumberFormat.getCurrencyInstance(locale)
        runCatching { formatter.currency = Currency.getInstance(currency) }
        formatter.minimumFractionDigits = 2
        formatter.maximumFractionDigits = 2
        return formatter.format(BigDecimal(minor).movePointLeft(2))
    }

    companion object {
        const val DEFAULT_CURRENCY = "EUR"
        private val GERMANY: Locale = Locale.Builder().setLanguage("de").setRegion("DE").build()
        val ZERO = Money(0)
    }
}
