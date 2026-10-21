package com.crustandco.customer.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.ZoneId

class MoneyAndDateTest {
    @Test
    fun `formats euros in German style with cents`() {
        val text = Money(750).format()
        assertTrue(text, text.startsWith("7,50") && text.endsWith("€"))
    }

    @Test
    fun `formats large amounts with a dot for thousands and a comma for cents`() {
        val text = Money(129950).format()
        assertTrue(text, text.contains("1.299,50"))
    }

    @Test
    fun `adds and multiplies in minor units without rounding`() {
        assertEquals(Money(30000), Money(19900) + Money(10100))
        assertEquals(Money(59700), Money(19900) * 3)
    }

    @Test
    fun `refuses to add different currencies`() {
        assertThrows(IllegalArgumentException::class.java) { Money(100, "INR") + Money(100, "USD") }
    }

    @Test
    fun `formats order time in the given zone`() {
        val text = formatOrderTime("2026-10-16T19:42:00+05:30", ZoneId.of("Asia/Kolkata"))
        assertEquals("16 Oct, 7:42 pm".lowercase(), text.lowercase())
    }

    @Test
    fun `falls back to the raw text for an unparseable timestamp`() {
        assertEquals("not a date", formatOrderTime("not a date"))
    }
}
