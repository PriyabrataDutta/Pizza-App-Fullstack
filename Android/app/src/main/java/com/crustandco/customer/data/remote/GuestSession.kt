package com.crustandco.customer.data.remote

import com.crustandco.customer.core.AppError
import com.crustandco.customer.core.AppResult
import com.crustandco.customer.data.local.TokenStore
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * The customer's identity on this phone while there are no accounts: a private token the server gave the first time. Orders and
 * addresses belong to it. The first call that needs it registers a guest; every later call reuses the stored token.
 *
 * [register] asks the server for a new token and returns it. It is a parameter so this class has no network code of its own.
 */
class GuestSession(
    private val store: TokenStore,
    private val register: suspend () -> AppResult<String>,
) {
    private val lock = Mutex()

    /** The stored token, for the Authorization header. Null before the first registration. */
    fun token(): String? = store.read()

    private suspend fun ensure(): AppResult<Unit> = lock.withLock {
        if (store.read() != null) return AppResult.Success(Unit)
        when (val result = register()) {
            is AppResult.Success -> {
                store.write(result.data)
                AppResult.Success(Unit)
            }
            is AppResult.Failure -> result
        }
    }

    /**
     * Runs a call that needs the token. If the server no longer knows this device (401, for example after the database was reset),
     * the stored token is dropped, a new guest is registered and the call is tried once more.
     */
    suspend fun <T> call(block: suspend () -> AppResult<T>): AppResult<T> {
        (ensure() as? AppResult.Failure)?.let { return it }
        val used = store.read()
        val first = block()
        if (first !is AppResult.Failure || first.error != AppError.Unauthorized) return first

        // Forget the token only if nobody has replaced it already while this call was running.
        lock.withLock { if (store.read() == used) store.clear() }
        (ensure() as? AppResult.Failure)?.let { return it }
        return block()
    }
}
