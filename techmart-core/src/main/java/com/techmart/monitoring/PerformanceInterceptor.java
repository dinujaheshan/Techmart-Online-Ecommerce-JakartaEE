package com.techmart.monitoring;

import jakarta.annotation.Priority;
import jakarta.interceptor.AroundInvoke;
import jakarta.interceptor.Interceptor;
import jakarta.interceptor.InvocationContext;
import java.io.Serializable;
import java.util.concurrent.atomic.AtomicLong;
import java.util.logging.Logger;

@Interceptor
@Logged
@Priority(Interceptor.Priority.APPLICATION)
public class PerformanceInterceptor implements Serializable {
    private static final long serialVersionUID = 1L;
    private static final Logger LOGGER = Logger.getLogger(PerformanceInterceptor.class.getName());
    
    // Simple thread-safe metric counter for throughput monitoring
    private static final AtomicLong REQUEST_COUNTER = new AtomicLong(0);

    @AroundInvoke
    public Object logPerformance(InvocationContext context) throws Exception {
        long startTime = System.nanoTime();
        String className = context.getMethod().getDeclaringClass().getSimpleName();
        String methodName = context.getMethod().getName();
        long currentCount = REQUEST_COUNTER.incrementAndGet();

        try {
            return context.proceed();
        } finally {
            long duration = System.nanoTime() - startTime;
            double durationMillis = duration / 1_000_000.0;
            
            LOGGER.fine(String.format(
                "[METRIC] Request #%d | Method: %s.%s | Duration: %.3f ms | JVM Free Memory: %d MB",
                currentCount,
                className,
                methodName,
                durationMillis,
                Runtime.getRuntime().freeMemory() / (1024 * 1024)
            ));
        }
    }
}
