package com.crustandco.customer.data

import com.crustandco.customer.core.AppResult
import com.crustandco.customer.data.remote.CheckoutBody
import com.crustandco.customer.data.remote.CrustApi
import com.crustandco.customer.data.remote.ListResponseDto
import com.crustandco.customer.data.remote.NewAddressBody
import com.crustandco.customer.data.remote.PromotionDto
import com.crustandco.customer.data.remote.QuoteBody
import com.crustandco.customer.data.remote.toDomain
import com.crustandco.customer.data.repository.RemotePromotionRepository
import java.io.IOException
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class RemotePromotionRepositoryTest {
    /** A CrustApi that only answers promotions(): the next answer is taken from [answers], and every call is counted. */
    private class Server(private val answers: ArrayDeque<() -> ListResponseDto<PromotionDto>>) {
        var calls = 0
        val api: CrustApi = object : CrustApi {
            override suspend fun promotions(): ListResponseDto<PromotionDto> { calls++; return answers.removeFirst().invoke() }
            override suspend fun menuVersion() = error("unused")
            override suspend fun categories() = error("unused")
            override suspend fun products(category: String?, search: String?, cursor: String?, limit: Int?) = error("unused")
            override suspend fun product(id: String) = error("unused")
            override suspend fun registerGuest() = error("unused")
            override suspend fun addresses() = error("unused")
            override suspend fun addAddress(body: NewAddressBody) = error("unused")
            override suspend fun quote(body: QuoteBody) = error("unused")
            override suspend fun checkout(body: CheckoutBody) = error("unused")
            override suspend fun orders() = error("unused")
            override suspend fun order(id: String) = error("unused")
        }
    }

    private fun banner(id: String, title: String = id) = PromotionDto(id = id, title = title, detail = "detail", code = null, imageUrl = null)

    @Test
    fun `maps the banner for the home screen, treating blank code and picture as none`() {
        val p = PromotionDto(id = "1", title = "Angebot 1 · 25 €", detail = "2 große Pizzen", code = " ", imageUrl = "").toDomain()
        assertEquals("Angebot 1 · 25 €", p.title)
        assertEquals("2 große Pizzen", p.detail)
        assertNull(p.code)
        assertNull(p.imageUrl)
        val withBoth = PromotionDto(id = "2", title = "T", code = "WELCOME5", imageUrl = "https://cdn.example/promotions/a.webp").toDomain()
        assertEquals("WELCOME5", withBoth.code)
        assertEquals("https://cdn.example/promotions/a.webp", withBoth.imageUrl)
    }

    @Test
    fun `reads the banners from the server in the order it sends them`() = runBlocking {
        val server = Server(ArrayDeque(listOf({ ListResponseDto(listOf(banner("a"), banner("b"))) })))
        val result = RemotePromotionRepository({ server.api }).promotions()
        assertEquals(listOf("a", "b"), (result as AppResult.Success).data.map { it.id })
    }

    @Test
    fun `going back to home within a minute costs no network, a minute later it refreshes`() = runBlocking {
        var clock = 0L
        val server = Server(ArrayDeque(listOf({ ListResponseDto(listOf(banner("a"))) }, { ListResponseDto(listOf(banner("b"))) })))
        val repo = RemotePromotionRepository({ server.api }, now = { clock })
        repo.promotions(); repo.promotions()
        assertEquals(1, server.calls)
        clock = 61_000
        assertEquals(listOf("b"), (repo.promotions() as AppResult.Success).data.map { it.id })
        assertEquals(2, server.calls)
    }

    @Test
    fun `offline, the last banners keep showing`() = runBlocking {
        var clock = 0L
        val server = Server(ArrayDeque(listOf({ ListResponseDto(listOf(banner("a"))) }, { throw IOException("offline") })))
        val repo = RemotePromotionRepository({ server.api }, now = { clock })
        repo.promotions()
        clock = 120_000
        assertEquals(listOf("a"), (repo.promotions() as AppResult.Success).data.map { it.id })
    }

    @Test
    fun `offline with nothing saved is a failure the home screen ignores`() = runBlocking {
        val server = Server(ArrayDeque(listOf({ throw IOException("offline") })))
        assertTrue(RemotePromotionRepository({ server.api }).promotions() is AppResult.Failure)
    }
}
