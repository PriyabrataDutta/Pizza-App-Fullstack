package com.crustandco.customer.core.designsystem

import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.crustandco.customer.R

/**
 * The app's one icon family: Phosphor Icons (MIT), https://phosphoricons.com.
 * Every icon has a light "regular" weight and a solid "fill" weight. Use regular by default and fill for the selected
 * or active state, so state reads from shape and not from color alone. Generated from res/drawable/ph_*.xml.
 */
enum class Ph(@DrawableRes val regular: Int, @DrawableRes val fill: Int) {
    ArrowLeft(R.drawable.ph_arrow_left, R.drawable.ph_arrow_left_fill),
    Bell(R.drawable.ph_bell, R.drawable.ph_bell_fill),
    BellSimple(R.drawable.ph_bell_simple, R.drawable.ph_bell_simple_fill),
    BowlFood(R.drawable.ph_bowl_food, R.drawable.ph_bowl_food_fill),
    Cake(R.drawable.ph_cake, R.drawable.ph_cake_fill),
    Camera(R.drawable.ph_camera, R.drawable.ph_camera_fill),
    CaretDown(R.drawable.ph_caret_down, R.drawable.ph_caret_down_fill),
    CaretRight(R.drawable.ph_caret_right, R.drawable.ph_caret_right_fill),
    Check(R.drawable.ph_check, R.drawable.ph_check_fill),
    CheckCircle(R.drawable.ph_check_circle, R.drawable.ph_check_circle_fill),
    Cheese(R.drawable.ph_cheese, R.drawable.ph_cheese_fill),
    ChefHat(R.drawable.ph_chef_hat, R.drawable.ph_chef_hat_fill),
    Clock(R.drawable.ph_clock, R.drawable.ph_clock_fill),
    Coffee(R.drawable.ph_coffee, R.drawable.ph_coffee_fill),
    Cookie(R.drawable.ph_cookie, R.drawable.ph_cookie_fill),
    CreditCard(R.drawable.ph_credit_card, R.drawable.ph_credit_card_fill),
    ForkKnife(R.drawable.ph_fork_knife, R.drawable.ph_fork_knife_fill),
    GoogleLogo(R.drawable.ph_google_logo, R.drawable.ph_google_logo_fill),
    Hamburger(R.drawable.ph_hamburger, R.drawable.ph_hamburger_fill),
    Headset(R.drawable.ph_headset, R.drawable.ph_headset_fill),
    Heart(R.drawable.ph_heart, R.drawable.ph_heart_fill),
    House(R.drawable.ph_house, R.drawable.ph_house_fill),
    HouseLine(R.drawable.ph_house_line, R.drawable.ph_house_line_fill),
    Info(R.drawable.ph_info, R.drawable.ph_info_fill),
    ListBullets(R.drawable.ph_list_bullets, R.drawable.ph_list_bullets_fill),
    Lock(R.drawable.ph_lock, R.drawable.ph_lock_fill),
    MagnifyingGlass(R.drawable.ph_magnifying_glass, R.drawable.ph_magnifying_glass_fill),
    MapPin(R.drawable.ph_map_pin, R.drawable.ph_map_pin_fill),
    Minus(R.drawable.ph_minus, R.drawable.ph_minus_fill),
    Money(R.drawable.ph_money, R.drawable.ph_money_fill),
    Moped(R.drawable.ph_moped, R.drawable.ph_moped_fill),
    Package(R.drawable.ph_package, R.drawable.ph_package_fill),
    PencilSimple(R.drawable.ph_pencil_simple, R.drawable.ph_pencil_simple_fill),
    Phone(R.drawable.ph_phone, R.drawable.ph_phone_fill),
    Pizza(R.drawable.ph_pizza, R.drawable.ph_pizza_fill),
    Plus(R.drawable.ph_plus, R.drawable.ph_plus_fill),
    Receipt(R.drawable.ph_receipt, R.drawable.ph_receipt_fill),
    SealPercent(R.drawable.ph_seal_percent, R.drawable.ph_seal_percent_fill),
    ShieldCheck(R.drawable.ph_shield_check, R.drawable.ph_shield_check_fill),
    ShoppingBag(R.drawable.ph_shopping_bag, R.drawable.ph_shopping_bag_fill),
    SignOut(R.drawable.ph_sign_out, R.drawable.ph_sign_out_fill),
    Star(R.drawable.ph_star, R.drawable.ph_star_fill),
    Storefront(R.drawable.ph_storefront, R.drawable.ph_storefront_fill),
    Tag(R.drawable.ph_tag, R.drawable.ph_tag_fill),
    Ticket(R.drawable.ph_ticket, R.drawable.ph_ticket_fill),
    Trash(R.drawable.ph_trash, R.drawable.ph_trash_fill),
    User(R.drawable.ph_user, R.drawable.ph_user_fill),
    WarningCircle(R.drawable.ph_warning_circle, R.drawable.ph_warning_circle_fill),
    X(R.drawable.ph_x, R.drawable.ph_x_fill),
}

@Composable
fun PhIcon(
    icon: Ph,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    tint: Color = LocalContentColor.current,
    filled: Boolean = false,
    size: Dp = 24.dp,
) {
    Icon(
        painter = painterResource(if (filled) icon.fill else icon.regular),
        contentDescription = contentDescription,
        modifier = modifier.size(size),
        tint = tint,
    )
}
