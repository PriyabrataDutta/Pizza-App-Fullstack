package com.crustandco.customer.data.local

import android.content.Context
import com.crustandco.customer.core.AppError
import com.crustandco.customer.core.AppResult
import com.crustandco.customer.domain.AuthRepository
import com.crustandco.customer.domain.AuthState
import com.crustandco.customer.domain.ProfileEdit
import com.crustandco.customer.domain.UserProfile
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Tiny key-value store, so the demo account can be saved on the device and faked in tests. */
interface KeyValueStore {
    fun get(key: String): String?
    fun put(key: String, value: String?)
}

class SharedPreferencesStore(context: Context) : KeyValueStore {
    private val prefs = context.getSharedPreferences("crust_account", Context.MODE_PRIVATE)
    override fun get(key: String): String? = prefs.getString(key, null)
    override fun put(key: String, value: String?) = prefs.edit().apply { if (value == null) remove(key) else putString(key, value) }.apply()
}

class InMemoryStore : KeyValueStore {
    private val map = mutableMapOf<String, String>()
    override fun get(key: String) = map[key]
    override fun put(key: String, value: String?) {
        if (value == null) map.remove(key) else map[key] = value
    }
}

/**
 * Demo sign-in. It saves a made-up profile on the device so the signed-in experience can be shown and kept between launches.
 * It holds no password or token, because there is nothing to protect: it is not a real account.
 * Real Google sign-in (Credential Manager + Supabase) replaces this class once the OAuth client exists. See docs/GOOGLE_SIGN_IN.md.
 */
class DemoAuthRepository(
    private val store: KeyValueStore,
    override val googleSignInAvailable: Boolean = false,
    private val latencyMs: Long = 450,
) : AuthRepository {
    private val _state = MutableStateFlow<AuthState>(load())
    override val state: StateFlow<AuthState> = _state.asStateFlow()

    private fun load(): AuthState {
        val id = store.get(ID) ?: return AuthState.SignedOut
        return AuthState.SignedIn(
            UserProfile(id, store.get(NAME).orEmpty(), store.get(EMAIL).orEmpty(), store.get(PHONE), photoUrl = null, isDemo = true),
        )
    }

    override suspend fun signInWithGoogle(): AppResult<UserProfile> {
        delay(latencyMs)
        // Never pretend to be Google. Until a real OAuth client is configured, say so.
        return AppResult.Failure(AppError.NotAvailable)
    }

    override suspend fun signInDemo(): AppResult<UserProfile> {
        delay(latencyMs)
        val user = UserProfile(DEMO_ID, "Demo Diner", "demo.diner@crustandco.test", phone = null, photoUrl = null, isDemo = true)
        save(user)
        _state.value = AuthState.SignedIn(user)
        return AppResult.Success(user)
    }

    override suspend fun updateProfile(edit: ProfileEdit): AppResult<UserProfile> {
        val current = (_state.value as? AuthState.SignedIn)?.user ?: return AppResult.Failure(AppError.Unauthorized)
        val problems = edit.validate()
        if (problems.isNotEmpty()) return AppResult.Failure(AppError.Validation("PROFILE_INVALID", problems.values.first()))
        delay(latencyMs)
        val updated = current.copy(name = edit.name.trim(), phone = edit.normalizedPhone())
        save(updated)
        _state.value = AuthState.SignedIn(updated)
        return AppResult.Success(updated)
    }

    override fun signOut() {
        listOf(ID, NAME, EMAIL, PHONE).forEach { store.put(it, null) }
        _state.value = AuthState.SignedOut
    }

    private fun save(user: UserProfile) {
        store.put(ID, user.id)
        store.put(NAME, user.name)
        store.put(EMAIL, user.email)
        store.put(PHONE, user.phone)
    }

    private companion object {
        const val DEMO_ID = "demo-user"
        const val ID = "id"
        const val NAME = "name"
        const val EMAIL = "email"
        const val PHONE = "phone"
    }
}
