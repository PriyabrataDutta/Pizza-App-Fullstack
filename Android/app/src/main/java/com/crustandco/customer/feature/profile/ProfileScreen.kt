package com.crustandco.customer.feature.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.crustandco.customer.BuildConfig
import com.crustandco.customer.LocalAppContainer
import com.crustandco.customer.core.comingSoon
import com.crustandco.customer.core.designsystem.Ph
import com.crustandco.customer.core.designsystem.PhIcon
import com.crustandco.customer.core.designsystem.components.Avatar
import com.crustandco.customer.core.designsystem.components.CrustCard
import com.crustandco.customer.core.designsystem.components.CrustTopBar
import com.crustandco.customer.core.designsystem.components.PrimaryButton
import com.crustandco.customer.core.designsystem.components.SecondaryButton
import com.crustandco.customer.core.designsystem.staggeredEntrance
import com.crustandco.customer.core.rememberNotifier
import com.crustandco.customer.domain.AuthState
import com.crustandco.customer.domain.ProfileEdit
import com.crustandco.customer.domain.UserProfile
import com.crustandco.customer.feature.account.AccountUiState
import com.crustandco.customer.feature.account.AccountViewModel

private data class ProfileRow(val icon: Ph, val label: String, val onClick: () -> Unit)

@Composable
fun ProfileScreen(
    contentPadding: PaddingValues,
    onBack: () -> Unit,
    onOpenAddresses: () -> Unit,
    onOpenOrders: () -> Unit,
    onSignIn: () -> Unit,
) {
    val container = LocalAppContainer.current
    val config = container.config
    val viewModel: AccountViewModel = viewModel(factory = viewModelFactory { initializer { AccountViewModel(container.authRepository) } })
    val authState by viewModel.authState.collectAsStateWithLifecycle()
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    val notify = rememberNotifier()
    val uriHandler = LocalUriHandler.current
    var aboutOpen by rememberSaveable { mutableStateOf(false) }
    var editOpen by rememberSaveable { mutableStateOf(false) }
    var confirmSignOut by rememberSaveable { mutableStateOf(false) }

    val rows = listOf(
        ProfileRow(Ph.MapPin, "My Addresses", onOpenAddresses),
        ProfileRow(Ph.CreditCard, "Payment Methods") { notify("Payment is cash on delivery. Cards aren’t saved.") },
        ProfileRow(Ph.Receipt, "Order History", onOpenOrders),
        ProfileRow(Ph.Heart, "Favorite Orders") { notify(comingSoon("Favourites")) },
        ProfileRow(Ph.Bell, "Notifications") { notify(comingSoon("Notifications")) },
        ProfileRow(Ph.Headset, "Help & Support") { notify(comingSoon("Help and support")) },
        ProfileRow(Ph.Info, "Imprint") { uriHandler.openUri(config.legalUrl("impressum")) },
        ProfileRow(Ph.ShieldCheck, "Privacy Policy") { uriHandler.openUri(config.legalUrl("datenschutz")) },
        ProfileRow(Ph.ListBullets, "Terms & Conditions") { uriHandler.openUri(config.legalUrl("agb")) },
        ProfileRow(Ph.Info, "About") { aboutOpen = true },
    )

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(top = contentPadding.calculateTopPadding())) {
        CrustTopBar(title = "My Profile", onBack = onBack)

        Column(
            Modifier.padding(start = 20.dp, end = 20.dp, top = 8.dp, bottom = contentPadding.calculateBottomPadding() + 24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            when (val state = authState) {
                is AuthState.SignedIn -> SignedInCard(state.user, onEdit = { editOpen = true }, modifier = Modifier.staggeredEntrance(0))
                AuthState.SignedOut -> GuestCard(onSignIn, Modifier.staggeredEntrance(0))
            }

            CrustCard(Modifier.fillMaxWidth().staggeredEntrance(1)) {
                rows.forEachIndexed { index, row ->
                    Row(
                        Modifier.fillMaxWidth().heightIn(min = 60.dp).clickable(role = Role.Button, onClick = row.onClick).padding(horizontal = 16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(14.dp),
                    ) {
                        Box(Modifier.size(38.dp).background(MaterialTheme.colorScheme.primaryContainer, RoundedCornerShape(12.dp)), contentAlignment = Alignment.Center) {
                            PhIcon(row.icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary, size = 22.dp)
                        }
                        Text(row.label, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                        PhIcon(Ph.CaretRight, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, size = 18.dp)
                    }
                    if (index < rows.lastIndex) HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.6f), modifier = Modifier.padding(start = 68.dp))
                }
            }

            if (authState is AuthState.SignedIn) {
                SecondaryButton(
                    text = "Sign out",
                    leadingIcon = Ph.SignOut,
                    destructive = true,
                    onClick = { confirmSignOut = true },
                    modifier = Modifier.fillMaxWidth().staggeredEntrance(2),
                )
            }

            if (config.isDebug) {
                DeveloperCard(
                    dataSource = when {
                        config.liveOrders || !config.useMockData -> "Live API (menu and orders)"
                        config.liveCatalog -> "Live menu, demo orders"
                        else -> "Demo data (no server)"
                    },
                    baseUrl = config.apiBaseUrl,
                    onAdvanceOrder = container.advanceDemoOrder?.let { advance ->
                        {
                            advance()
                            notify("Moved the newest active demo order to its next status.")
                        }
                    },
                    modifier = Modifier.staggeredEntrance(3),
                )
            }
        }
    }

    if (editOpen) {
        (authState as? AuthState.SignedIn)?.let { signedIn ->
            EditProfileSheet(
                user = signedIn.user,
                ui = ui,
                onSave = { edit -> viewModel.saveProfile(edit) { editOpen = false; notify("Profile saved") } },
                onDismiss = { editOpen = false; viewModel.clearProfileErrors() },
            )
        }
    }

    if (confirmSignOut) {
        AlertDialog(
            onDismissRequest = { confirmSignOut = false },
            title = { Text("Sign out?") },
            text = { Text("You’ll be browsing as a guest. Your cart stays as it is.") },
            confirmButton = {
                TextButton(onClick = {
                    confirmSignOut = false
                    viewModel.signOut()
                    notify("You’re signed out")
                }) { Text("Sign out", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = { TextButton(onClick = { confirmSignOut = false }) { Text("Stay signed in", color = MaterialTheme.colorScheme.onSurfaceVariant) } },
        )
    }

    if (aboutOpen) {
        AlertDialog(
            onDismissRequest = { aboutOpen = false },
            title = { Text("Crust & Co. Pizza House") },
            text = {
                Text(
                    "Version ${BuildConfig.VERSION_NAME}. Menu, prices and orders come from the restaurant. Payment is cash on delivery.",
                )
            },
            confirmButton = { TextButton(onClick = { aboutOpen = false }) { Text("OK") } },
        )
    }
}

@Composable
private fun SignedInCard(user: UserProfile, onEdit: () -> Unit, modifier: Modifier = Modifier) {
    CrustCard(modifier.fillMaxWidth()) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Avatar(user, size = 72.dp)
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(user.name, style = MaterialTheme.typography.headlineMedium)
                    Text(user.email, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    user.phone?.let { Text("+91 ${it.take(5)} ${it.drop(5)}", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                }
            }
            if (user.isDemo) {
                Text(
                    "Demo account",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.background(MaterialTheme.colorScheme.primaryContainer, RoundedCornerShape(percent = 50)).padding(horizontal = 12.dp, vertical = 5.dp),
                )
            }
            SecondaryButton("Edit profile", onClick = onEdit, leadingIcon = Ph.PencilSimple, modifier = Modifier.fillMaxWidth())
        }
    }
}

@Composable
private fun GuestCard(onSignIn: () -> Unit, modifier: Modifier = Modifier) {
    CrustCard(modifier.fillMaxWidth()) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Box(Modifier.size(64.dp).background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(percent = 50)), contentAlignment = Alignment.Center) {
                    PhIcon(Ph.User, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, size = 32.dp)
                }
                Column(Modifier.weight(1f)) {
                    Text("You’re browsing as a guest", style = MaterialTheme.typography.titleLarge)
                    Text("Sign in to save your details and follow your orders.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            PrimaryButton("Sign in", onClick = onSignIn, modifier = Modifier.fillMaxWidth())
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EditProfileSheet(user: UserProfile, ui: AccountUiState, onSave: (ProfileEdit) -> Unit, onDismiss: () -> Unit) {
    var name by rememberSaveable { mutableStateOf(user.name) }
    var phone by rememberSaveable { mutableStateOf(user.phone.orEmpty()) }

    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = MaterialTheme.colorScheme.background) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(bottom = 28.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Edit profile", style = MaterialTheme.typography.headlineMedium)
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                label = { Text("Name") },
                isError = ui.profileErrors.containsKey("name"),
                supportingText = { ui.profileErrors["name"]?.let { Text(it) } },
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
                shape = MaterialTheme.shapes.medium,
            )
            OutlinedTextField(
                value = phone,
                onValueChange = { phone = it.filter { c -> c.isDigit() || c == '+' || c == ' ' }.take(15) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                label = { Text("Mobile number (optional)") },
                isError = ui.profileErrors.containsKey("phone"),
                supportingText = { ui.profileErrors["phone"]?.let { Text(it) } },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone, imeAction = ImeAction.Done),
                shape = MaterialTheme.shapes.medium,
            )
            Text("Your email comes from your sign-in and can’t be changed here.", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            ui.error?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.error) }
            PrimaryButton(
                text = "Save changes",
                onClick = { onSave(ProfileEdit(name, phone)) },
                loading = ui.busy == AccountUiState.Busy.SavingProfile,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
private fun DeveloperCard(dataSource: String, baseUrl: String, onAdvanceOrder: (() -> Unit)?, modifier: Modifier = Modifier) {
    CrustCard(modifier.fillMaxWidth(), elevation = 0.dp, containerColor = MaterialTheme.colorScheme.surfaceVariant) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Developer info (debug builds only)", style = MaterialTheme.typography.titleMedium)
            Text("Data source: $dataSource", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text("API base URL: $baseUrl", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (onAdvanceOrder != null) {
                // Stands in for the restaurant dashboard so the tracking screen can be demonstrated without a backend.
                SecondaryButton("Advance newest demo order", onClick = onAdvanceOrder, modifier = Modifier.fillMaxWidth())
            }
        }
    }
}
