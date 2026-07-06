package com.techmart.service;

import com.techmart.monitoring.Logged;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import jakarta.ejb.ConcurrencyManagement;
import jakarta.ejb.ConcurrencyManagementType;
import jakarta.ejb.Lock;
import jakarta.ejb.LockType;
import jakarta.ejb.Singleton;
import jakarta.ejb.Startup;
import java.util.HashMap;
import java.util.Map;
import java.util.logging.Logger;

@Singleton
@Startup
@ConcurrencyManagement(ConcurrencyManagementType.CONTAINER)
@Logged
public class SystemConfigurationManager {
    private static final Logger LOGGER = Logger.getLogger(SystemConfigurationManager.class.getName());

    private Map<String, String> configurations;

    @PostConstruct
    public void init() {
        configurations = new HashMap<>();
        
        // Simulate loading configurations from a system properties file or DB
        configurations.put("app.name", "TechMart Online");
        configurations.put("app.version", "v1.0.0-Modernized");
        configurations.put("app.support.email", "support@techmart.com");
        configurations.put("app.tax.rate", "0.08"); // 8% sales tax
        configurations.put("app.shipping.flat_rate", "15.00");
        
        LOGGER.info("[LIFECYCLE] SystemConfigurationManager @Startup - Eagerly loaded " + configurations.size() + " configurations.");
    }

    @PreDestroy
    public void cleanup() {
        configurations.clear();
        LOGGER.info("[LIFECYCLE] SystemConfigurationManager @PreDestroy - Configuration cache cleared.");
    }

    /**
     * Gets a configuration value.
     * Uses READ lock for high concurrent access.
     */
    @Lock(LockType.READ)
    public String getConfiguration(String key) {
        return configurations.get(key);
    }

    /**
     * Gets a configuration value as double (e.g., tax rate).
     * Uses READ lock.
     */
    @Lock(LockType.READ)
    public double getDoubleConfiguration(String key, double defaultValue) {
        String val = configurations.get(key);
        if (val == null) return defaultValue;
        try {
            return Double.parseDouble(val);
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    /**
     * Set configuration value dynamically at runtime.
     * Uses WRITE lock to ensure threads wait for the modification to finish.
     */
    @Lock(LockType.WRITE)
    public void setConfiguration(String key, String value) {
        configurations.put(key, value);
        LOGGER.info("[CONFIG] Dynamic configuration update: " + key + " = " + value);
    }
}
