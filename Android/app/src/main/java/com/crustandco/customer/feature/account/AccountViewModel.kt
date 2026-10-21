package com.crustandco.customer.feature.account

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.crustandco.customer.core.AppError
import com.crustandco.customer.core.AppResult
import com.crustandco.customer.domain.AuthRepository
import com.crustandco.customer.domain.AuthState
import com.crustandco.customer.domain.ProfileEdit
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class AccountUiState(
    /** What is happening right now, so only that button shows a spinner and the others go inert. */
    val busy: Busy? = null,
    /** Set when the customer taps Google but Google sign-in isn't configured. The screen explains what's missing. */
    val googleUnavailable: Boolean = false,
    val error: String? = null,
    val profileErrors: Map<String, String> = emptyMap(),
) {
    enum class Busy { Google, Demo, SavingProfile }
}

class AccountViewModel(private val auth: AuthRepository) : ViewModel() {
    val authState: StateFlow<AuthState> = auth.state
    val googleSignInAvailable: Boolean get() = auth.googleSignInAvailable

    private val _ui = MutableStateFlow(AccountUiState())
    val ui: StateFlow<AccountUiState> = _ui.asStateFlow()

    fun signInWithGoogle(onSignedIn: () -> Unit) {
        if (_ui.value.busy != null) return
        _ui.update { it.copy(busy = AccountUiState.Busy.Google, error = null, googleUnavailable = false) }
        viewModelScope.launch {
            when (val result = auth.signInWithGoogle()) {
                is AppResult.Success -> {
                    _ui.update { it.copy(busy = null) }
                    onSignedIn()
                }
                is AppResult.Failure ->
                    if (result.error == AppError.NotAvailable) _ui.update { it.copy(busy = null, googleUnavailable = true) }
                    else _ui.update { it.copy(busy = null, error = result.error.userMessage) }
            }
        }
    }

    fun signInDemo(onSignedIn: () -> Unit) {
        if (_ui.value.busy != null) return
        _ui.update { it.copy(busy = AccountUiState.Busy.Demo, error = null, googleUnavailable = false) }
        viewModelScope.launch {
            when (val result = auth.signInDemo()) {
                is AppResult.Success -> {
                    _ui.update { it.copy(busy = null) }
                    onSignedIn()
                }
                is AppResult.Failure -> _ui.update { it.copy(busy = null, error = result.error.userMessage) }
            }
        }
    }

    fun dismissGoogleHelp() = _ui.update { it.copy(googleUnavailable = false) }

    /** Checks the fields first so the form can mark the right one, then saves. [onSaved] runs after the save succeeds. */
    fun saveProfile(edit: ProfileEdit, onSaved: () -> Unit) {
        val problems = edit.validate()
        if (problems.isNotEmpty()) {
            _ui.update { it.copy(profileErrors = problems) }
            return
        }
        if (_ui.value.busy != null) return
        _ui.update { it.copy(busy = AccountUiState.Busy.SavingProfile, profileErrors = emptyMap(), error = null) }
        viewModelScope.launch {
            when (val result = auth.updateProfile(edit)) {
                is AppResult.Success -> {
                    _ui.update { it.copy(busy = null) }
                    onSaved()
                }
                is AppResult.Failure -> _ui.update { it.copy(busy = null, error = result.error.userMessage) }
            }
        }
    }

    fun clearProfileErrors() = _ui.update { it.copy(profileErrors = emptyMap(), error = null) }

    fun signOut() = auth.signOut()
}
