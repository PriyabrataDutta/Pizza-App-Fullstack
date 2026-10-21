package com.crustandco.customer

import android.app.Application

class CrustApp : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(AppConfig.fromBuildConfig(), applicationContext)
    }
}
