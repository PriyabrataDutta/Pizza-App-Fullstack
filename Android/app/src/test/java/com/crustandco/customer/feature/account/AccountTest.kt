package com.crustandco.customer.feature.account

import com.crustandco.customer.core.AppError
import com.crustandco.customer.core.AppResult
import com.crustandco.customer.data.local.DemoAuthRepository
import com.crustandco.customer.data.local.InMemoryStore
import com.crustandco.customer.domain.AuthState
import com.crustandco.customer.domain.ProfileEdit
import com.crustandco.customer.domain.UserProfile
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class AccountTest {
    @Before
    fun setUp() = Dispatchers.setMain(UnconfinedTestDispatcher())

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun repo(store: InMemoryStore = InMemoryStore()) = DemoAuthRepository(store, latencyMs = 0)

    private fun signedInUser(repo: DemoAuthRepository) = (repo.state.value as AuthState.SignedIn).user

    @Test
    fun `starts signed out`() {
        assertEquals(AuthState.SignedOut, repo().state.value)
    }

    @Test
    fun `the demo account signs in and is labelled as a demo`() = runTest {
        val repo = repo()
        val result = repo.signInDemo() as AppResult.Success
        assertTrue(result.data.isDemo)
        assertTrue(signedInUser(repo).email.endsWith("@crustandco.test"))
    }

    @Test
    fun `google sign-in says it is not available instead of pretending`() = runTest {
        val repo = repo()
        val failure = repo.signInWithGoogle() as AppResult.Failure
        assertEquals(AppError.NotAvailable, failure.error)
        assertEquals(AuthState.SignedOut, repo.state.value)
        assertFalse(repo.googleSignInAvailable)
    }

    @Test
    fun `the session survives a restart`() = runTest {
        val store = InMemoryStore()
        repo(store).signInDemo()
        val restarted = repo(store)
        assertEquals("Demo Diner", signedInUser(restarted).name)
    }

    @Test
    fun `signing out clears everything saved`() = runTest {
        val store = InMemoryStore()
        val repo = repo(store)
        repo.signInDemo()
        repo.signOut()
        assertEquals(AuthState.SignedOut, repo.state.value)
        assertEquals(AuthState.SignedOut, repo(store).state.value)
    }

    @Test
    fun `editing the profile saves the name and a normalised phone`() = runTest {
        val repo = repo()
        repo.signInDemo()
        val updated = (repo.updateProfile(ProfileEdit("  Priya Nair ", "+91 98765 43210")) as AppResult.Success).data
        assertEquals("Priya Nair", updated.name)
        assertEquals("9876543210", updated.phone)
        assertEquals("Priya Nair", signedInUser(repo).name)
    }

    @Test
    fun `profile edits are saved for next launch`() = runTest {
        val store = InMemoryStore()
        val repo = repo(store)
        repo.signInDemo()
        repo.updateProfile(ProfileEdit("Priya Nair", "9876543210"))
        assertEquals("9876543210", signedInUser(repo(store)).phone)
    }

    @Test
    fun `a signed out user cannot edit a profile`() = runTest {
        val failure = repo().updateProfile(ProfileEdit("Priya", "")) as AppResult.Failure
        assertEquals(AppError.Unauthorized, failure.error)
    }

    @Test
    fun `an invalid edit is refused and nothing changes`() = runTest {
        val repo = repo()
        repo.signInDemo()
        val failure = repo.updateProfile(ProfileEdit("P", "123")) as AppResult.Failure
        assertTrue(failure.error is AppError.Validation)
        assertEquals("Demo Diner", signedInUser(repo).name)
    }

    @Test
    fun `name must be 2 to 60 characters`() {
        assertTrue(ProfileEdit("A", "").validate().containsKey("name"))
        assertTrue(ProfileEdit("A".repeat(61), "").validate().containsKey("name"))
        assertTrue(ProfileEdit("Priya", "").validate().isEmpty())
    }

    @Test
    fun `phone is optional but must be a valid Indian mobile when given`() {
        assertTrue(ProfileEdit("Priya", "").validate().isEmpty())
        assertTrue(ProfileEdit("Priya", "98765 43210").validate().isEmpty())
        assertTrue(ProfileEdit("Priya", "+919876543210").validate().isEmpty())
        assertTrue(ProfileEdit("Priya", "09876543210").validate().isEmpty())
        assertTrue(ProfileEdit("Priya", "12345").validate().containsKey("phone"))
        assertTrue(ProfileEdit("Priya", "5876543210").validate().containsKey("phone")) // mobile numbers start with 6-9
        assertTrue(ProfileEdit("Priya", "abc").validate().containsKey("phone"))
    }

    @Test
    fun `a number that starts with 91 is not mistaken for a country code`() {
        assertEquals("9123456789", ProfileEdit("Priya", "9123456789").normalizedPhone())
        assertEquals("9123456789", ProfileEdit("Priya", "+91 9123456789").normalizedPhone())
    }

    @Test
    fun `initials and first name come from the display name`() {
        val user = UserProfile("1", "Priya Nair", "p@x.test", null, null, false)
        assertEquals("PN", user.initials)
        assertEquals("Priya", user.firstName)
        assertEquals("M", UserProfile("2", "madhu", "m@x.test", null, null, false).initials)
        assertEquals("?", UserProfile("3", "  ", "x@x.test", null, null, false).initials)
        assertNull(UserProfile("4", "A B C", "x@x.test", null, null, false).phone)
        assertEquals("AB", UserProfile("4", "A B C", "x@x.test", null, null, false).initials)
    }

    @Test
    fun `the view model explains unavailable google sign-in and keeps the user signed out`() {
        val vm = AccountViewModel(repo())
        var signedIn = false
        vm.signInWithGoogle { signedIn = true }
        assertTrue(vm.ui.value.googleUnavailable)
        assertFalse(signedIn)
        assertEquals(AuthState.SignedOut, vm.authState.value)
        vm.dismissGoogleHelp()
        assertFalse(vm.ui.value.googleUnavailable)
    }

    @Test
    fun `the view model signs in with the demo account`() {
        val vm = AccountViewModel(repo())
        var signedIn = false
        vm.signInDemo { signedIn = true }
        assertTrue(signedIn)
        assertTrue(vm.authState.value is AuthState.SignedIn)
    }

    @Test
    fun `the view model marks the bad field when saving an invalid profile`() {
        val vm = AccountViewModel(repo())
        vm.signInDemo { }
        var saved = false
        vm.saveProfile(ProfileEdit("", "000")) { saved = true }
        assertFalse(saved)
        assertEquals(setOf("name", "phone"), vm.ui.value.profileErrors.keys)
    }

    @Test
    fun `the view model signs out`() {
        val vm = AccountViewModel(repo())
        vm.signInDemo { }
        vm.signOut()
        assertEquals(AuthState.SignedOut, vm.authState.value)
    }
}
