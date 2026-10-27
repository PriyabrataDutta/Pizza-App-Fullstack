package com.crustandco.customer.data.local

import android.content.Context

/** The name and phone the customer last gave at checkout, so they type them once. Not a secret, but never leaves the phone except in an order. */
data class Contact(val name: String = "", val phone: String = "")

interface ContactStore {
    fun load(): Contact
    fun save(contact: Contact)
}

class InMemoryContactStore : ContactStore {
    private var contact = Contact()
    override fun load() = contact
    override fun save(contact: Contact) { this.contact = contact }
}

class PrefsContactStore(context: Context) : ContactStore {
    private val prefs = context.applicationContext.getSharedPreferences("checkout_contact", Context.MODE_PRIVATE)
    override fun load() = Contact(prefs.getString("name", "").orEmpty(), prefs.getString("phone", "").orEmpty())
    override fun save(contact: Contact) {
        prefs.edit().putString("name", contact.name).putString("phone", contact.phone).apply()
    }
}
