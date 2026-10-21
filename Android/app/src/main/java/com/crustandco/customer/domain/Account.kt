package com.crustandco.customer.domain

import com.crustandco.customer.core.AppResult
import kotlinx.coroutines.flow.StateFlow

data class UserProfile(
    val id: String,
    val name: String,
    val email: String,
    val phone: String?,
    /** Google profile picture, when there is one. */
    val photoUrl: String?,
    /** True for the built-in demo account. It is not a real Google or Supabase user. */
    val isDemo: Boolean,
) {
    val firstName: String get() = name.trim().substringBefore(' ').ifEmpty { name }

    /** Up to two letters for the avatar: "Priya Nair" -> "PN". */
    val initials: String
        get() = name.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }.take(2).joinToString("") { it.first().uppercase() }.ifEmpty { "?" }
}

sealed interface AuthState {
    data object SignedOut : AuthState
    data class SignedIn(val user: UserProfile) : AuthState
}

/** What the customer may change on their profile. The email comes from the sign-in provider and can't be edited here. */
data class ProfileEdit(val name: String, val phone: String) {
    /** Field name to message. Empty when valid. The server validates again once accounts are live. */
    fun validate(): Map<String, String> = buildMap {
        if (name.trim().length !in 2..60) put("name", "Enter your name, 2 to 60 characters.")
        // Phone is optional. If given, it must be a 10-digit Indian mobile number.
        if (phone.isNotBlank() && normalizedPhone() == null) put("phone", "Enter a 10-digit mobile number.")
    }

    /** The 10 digits (an optional +91 or leading 0 is ignored), or null if blank or not a valid mobile number. */
    fun normalizedPhone(): String? {
        val digits = phone.filter { it.isDigit() }
        val ten = when {
            digits.length == 12 && digits.startsWith("91") -> digits.drop(2)
            digits.length == 11 && digits.startsWith("0") -> digits.drop(1)
            else -> digits
        }
        return ten.takeIf { it.length == 10 && it[0] in '6'..'9' }
    }
}

interface AuthRepository {
    val state: StateFlow<AuthState>

    /** True once a Google OAuth client is configured for this build. Until then the Google button explains what's missing. */
    val googleSignInAvailable: Boolean

    /** Fails with [com.crustandco.customer.core.AppError.NotAvailable] until Google sign-in is configured. */
    suspend fun signInWithGoogle(): AppResult<UserProfile>

    /** A clearly labelled demo account, so the signed-in experience can be explored without any setup. */
    suspend fun signInDemo(): AppResult<UserProfile>

    suspend fun updateProfile(edit: ProfileEdit): AppResult<UserProfile>

    fun signOut()
}
