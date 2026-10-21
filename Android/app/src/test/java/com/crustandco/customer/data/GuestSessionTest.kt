package com.crustandco.customer.data

import com.crustandco.customer.core.AppError
import com.crustandco.customer.core.AppResult
import com.crustandco.customer.data.local.TokenStore
import com.crustandco.customer.data.remote.GuestSession
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class GuestSessionTest {
    private class MemoryStore(var value: String? = null) : TokenStore {
        override fun read() = value
        override fun write(token: String) { value = token }
        override fun clear() { value = null }
    }

    private class Registrar(private val results: MutableList<AppResult<String>>) {
        var calls = 0
        suspend fun register(): AppResult<String> = results[minOf(calls++, results.lastIndex)]
    }

    @Test
    fun `registers on the first call and reuses the token afterwards`() = runTest {
        val store = MemoryStore()
        val registrar = Registrar(mutableListOf(AppResult.Success("cc1_first")))
        val session = GuestSession(store, registrar::register)

        assertNull(session.token())
        assertEquals(AppResult.Success(1), session.call { AppResult.Success(1) })
        assertEquals("cc1_first", session.token())
        session.call { AppResult.Success(2) }
        assertEquals(1, registrar.calls)
    }

    @Test
    fun `an already stored token is used without registering`() = runTest {
        val registrar = Registrar(mutableListOf(AppResult.Success("cc1_new")))
        val session = GuestSession(MemoryStore("cc1_old"), registrar::register)
        session.call { AppResult.Success(Unit) }
        assertEquals(0, registrar.calls)
        assertEquals("cc1_old", session.token())
    }

    @Test
    fun `many calls at once register only one guest`() = runTest {
        val registrar = Registrar(mutableListOf(AppResult.Success("cc1_one")))
        val session = GuestSession(MemoryStore(), registrar::register)
        (1..8).map { async { session.call { AppResult.Success(it) } } }.awaitAll()
        assertEquals(1, registrar.calls)
    }

    @Test
    fun `a failed registration is returned and nothing is stored`() = runTest {
        val store = MemoryStore()
        val session = GuestSession(store, Registrar(mutableListOf(AppResult.Failure(AppError.Network)))::register)
        var ran = false
        val result = session.call { ran = true; AppResult.Success(Unit) }
        assertEquals(AppResult.Failure(AppError.Network), result)
        assertEquals(false, ran)
        assertNull(store.value)
    }

    @Test
    fun `a 401 drops the token, registers again and retries once`() = runTest {
        val store = MemoryStore("cc1_stale")
        val registrar = Registrar(mutableListOf(AppResult.Success("cc1_fresh")))
        val session = GuestSession(store, registrar::register)
        val tokensSeen = mutableListOf<String?>()
        val result = session.call {
            tokensSeen += store.value
            if (store.value == "cc1_stale") AppResult.Failure(AppError.Unauthorized) else AppResult.Success("ok")
        }
        assertEquals(AppResult.Success("ok"), result)
        assertEquals(listOf<String?>("cc1_stale", "cc1_fresh"), tokensSeen)
        assertEquals(1, registrar.calls)
    }

    @Test
    fun `a second 401 is returned, not retried forever`() = runTest {
        val registrar = Registrar(mutableListOf(AppResult.Success("cc1_a"), AppResult.Success("cc1_b")))
        val session = GuestSession(MemoryStore("cc1_stale"), registrar::register)
        var attempts = 0
        val result = session.call<Unit> { attempts++; AppResult.Failure(AppError.Unauthorized) }
        assertEquals(AppResult.Failure(AppError.Unauthorized), result)
        assertEquals(2, attempts)
    }

    @Test
    fun `other failures are passed through without touching the token`() = runTest {
        val store = MemoryStore("cc1_keep")
        val session = GuestSession(store, Registrar(mutableListOf(AppResult.Success("x")))::register)
        val result = session.call<Unit> { AppResult.Failure(AppError.Server) }
        assertEquals(AppResult.Failure(AppError.Server), result)
        assertEquals("cc1_keep", store.value)
    }
}
