package com.techmart.config;

import jakarta.annotation.sql.DataSourceDefinition;
import jakarta.ejb.Singleton;
import jakarta.ejb.Startup;
import jakarta.jms.JMSConnectionFactoryDefinition;
import jakarta.jms.JMSDestinationDefinition;
import jakarta.jms.JMSDestinationDefinitions;

@DataSourceDefinition(
    name = "java:app/jdbc/TechMartDS",
    className = "org.postgresql.ds.PGSimpleDataSource",
    url = "jdbc:postgresql://localhost:5432/postgres",
    serverName = "localhost",
    portNumber = 5432,
    databaseName = "postgres",
    user = "postgres",
    password = "*DinujaHeshan12", 
    properties = {
        "fish.payara.is-connection-validation-required=true",
        "fish.payara.connection-validation-method=custom-validation",
        "fish.payara.validation-classname=org.glassfish.api.jdbc.validation.PostgresConnectionValidation"
    }
)
@JMSConnectionFactoryDefinition(
    name = "java:app/jms/TechMartConnectionFactory"
)
@JMSDestinationDefinitions({
    @JMSDestinationDefinition(
        name = "java:app/jms/queue/OrderProcessingQueue",
        interfaceName = "jakarta.jms.Queue",
        destinationName = "OrderProcessingQueue"
    ),
    @JMSDestinationDefinition(
        name = "java:app/jms/queue/InventoryUpdateQueue",
        interfaceName = "jakarta.jms.Queue",
        destinationName = "InventoryUpdateQueue"
    ),
    @JMSDestinationDefinition(
        name = "java:app/jms/topic/CustomerNotificationTopic",
        interfaceName = "jakarta.jms.Topic",
        destinationName = "CustomerNotificationTopic"
    ),
    @JMSDestinationDefinition(
        name = "java:app/jms/queue/ContactQueue",
        interfaceName = "jakarta.jms.Queue",
        destinationName = "ContactQueue"
    ),
    @JMSDestinationDefinition(
        name = "java:app/jms/queue/ContactReplyQueue",
        interfaceName = "jakarta.jms.Queue",
        destinationName = "ContactReplyQueue"
    ),
    @JMSDestinationDefinition(
        name = "java:app/jms/topic/NewProductTopic",
        interfaceName = "jakarta.jms.Topic",
        destinationName = "NewProductTopic"
    )
})
@Singleton
@Startup
public class DatabaseConfig {
    // This class initializes the JNDI resources for the application automatically on startup.
}
