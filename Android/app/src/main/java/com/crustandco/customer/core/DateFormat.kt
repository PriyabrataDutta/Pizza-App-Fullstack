package com.crustandco.customer.core

import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

private val OrderTimeFormat: DateTimeFormatter = DateTimeFormatter.ofPattern("d MMM, h:mm a", Locale.ENGLISH)

/** Formats a server ISO 8601 timestamp in the device's time zone. Falls back to the raw text if it can't be parsed. */
fun formatOrderTime(iso: String, zone: ZoneId = ZoneId.systemDefault()): String =
    runCatching { OffsetDateTime.parse(iso).atZoneSameInstant(zone).format(OrderTimeFormat) }.getOrDefault(iso)
