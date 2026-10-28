package com.crustandco.customer

import org.junit.Assert.assertEquals
import org.junit.Test

class AppConfigTest {
    private fun config(base: String) = AppConfig(apiBaseUrl = base, useMockData = false, liveCatalog = true, liveOrders = true, isDebug = false)

    @Test
    fun `the legal pages live on the same site as the API`() {
        assertEquals("https://pizza-app-fullstack-backend.vercel.app/impressum", config("https://pizza-app-fullstack-backend.vercel.app/api/").legalUrl("impressum"))
        assertEquals("https://pizza-app-fullstack-backend.vercel.app/datenschutz", config("https://pizza-app-fullstack-backend.vercel.app/api/").legalUrl("datenschutz"))
    }

    @Test
    fun `works for a local server and for an address without the trailing slash`() {
        assertEquals("http://10.0.2.2:3000/agb", config("http://10.0.2.2:3000/api/").legalUrl("agb"))
        assertEquals("https://example.test/agb", config("https://example.test/api").legalUrl("agb"))
    }
}
