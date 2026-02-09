// ===== Config Builder =====

function toggleBuilderSection(titleElement) {
    const section = titleElement.closest('.builder-section');
    const fields = section.querySelector('.builder-fields');
    
    section.classList.toggle('expanded');
    fields.classList.toggle('collapsed');
}

// Toggle Common Buffer dependent fields based on Initial State
function toggleCommonBufferFields() {
    const initialState = document.getElementById('sr-buffer-initialState');
    const dependentContainer = document.getElementById('commonBufferDependentFields');
    const useStableBufferCheckbox = document.getElementById('sr-useStableBuffer');
    
    // Check if initial state has valid JSON content
    let hasValidInitialState = false;
    const value = initialState?.value?.trim();
    if (value) {
        try {
            JSON.parse(value);
            hasValidInitialState = true;
            initialState.style.borderColor = '';
        } catch (e) {
            initialState.style.borderColor = '#e74c3c';
        }
    } else {
        initialState.style.borderColor = '';
    }
    
    if (hasValidInitialState) {
        dependentContainer?.classList.remove('disabled');
        if (useStableBufferCheckbox) useStableBufferCheckbox.disabled = false;
    } else {
        dependentContainer?.classList.add('disabled');
        if (useStableBufferCheckbox) {
            useStableBufferCheckbox.disabled = true;
            useStableBufferCheckbox.checked = false;
        }
        // Also disable StableBuffer sub-fields
        toggleStableBufferFields();
    }
    
    // Trigger config update
    if (typeof updateConfigOutput === 'function') {
        updateConfigOutput();
    }
}

// Toggle StableBuffer configuration fields
function toggleStableBufferFields() {
    const useStableBuffer = document.getElementById('sr-useStableBuffer');
    const fieldsContainer = document.getElementById('stableBufferFields');
    const fields = fieldsContainer?.querySelectorAll('input, textarea');
    
    if (useStableBuffer?.checked) {
        fieldsContainer?.classList.remove('disabled');
        fields?.forEach(field => field.disabled = false);
    } else {
        fieldsContainer?.classList.add('disabled');
        fields?.forEach(field => field.disabled = true);
    }
    
    // Trigger config update
    if (typeof updateConfigOutput === 'function') {
        updateConfigOutput();
    }
}

// Toggle cache configuration fields
function toggleCacheFields() {
    const cacheEnabled = document.getElementById('sr-cache-enabled');
    const fieldsContainer = document.getElementById('cacheConfigFields');
    const fields = fieldsContainer?.querySelectorAll('input, textarea');
    
    if (cacheEnabled?.checked) {
        fieldsContainer?.classList.remove('disabled');
        fields?.forEach(field => field.disabled = false);
    } else {
        fieldsContainer?.classList.add('disabled');
        fields?.forEach(field => field.disabled = true);
    }
    
    // Trigger config update
    if (typeof updateConfigOutput === 'function') {
        updateConfigOutput();
    }
}

// Toggle trial mode configuration fields
function toggleTrialModeFields() {
    const trialModeEnabled = document.getElementById('sr-trialMode-enabled');
    const fieldsContainer = document.getElementById('trialModeConfigFields');
    const fields = fieldsContainer?.querySelectorAll('input');
    
    if (trialModeEnabled?.checked) {
        fieldsContainer?.classList.remove('disabled');
        fields?.forEach(field => field.disabled = false);
    } else {
        fieldsContainer?.classList.add('disabled');
        fields?.forEach(field => field.disabled = true);
    }
    
    // Trigger config update
    if (typeof updateConfigOutput === 'function') {
        updateConfigOutput();
    }
}

// Toggle observability hook fields based on logging checkboxes
function toggleObservabilityHook(type) {
    if (type === 'errors') {
        const logAllErrors = document.getElementById('sr-logAllErrors');
        const handleErrors = document.getElementById('sr-handleErrors');
        if (handleErrors) {
            handleErrors.disabled = !logAllErrors?.checked;
            if (!logAllErrors?.checked) {
                handleErrors.classList.add('field-disabled');
            } else {
                handleErrors.classList.remove('field-disabled');
            }
        }
    } else if (type === 'success') {
        const logAllSuccess = document.getElementById('sr-logAllSuccessfulAttempts');
        const handleSuccess = document.getElementById('sr-handleSuccessfulAttemptData');
        if (handleSuccess) {
            handleSuccess.disabled = !logAllSuccess?.checked;
            if (!logAllSuccess?.checked) {
                handleSuccess.classList.add('field-disabled');
            } else {
                handleSuccess.classList.remove('field-disabled');
            }
        }
    }
    
    // Trigger config update
    if (typeof updateConfigOutput === 'function') {
        updateConfigOutput();
    }
}

// Toggle type definition fields
function toggleTypeDefinitions() {
    const defineTypes = document.getElementById('sr-generic-define-types');
    const fieldsContainer = document.getElementById('typeDefinitionFields');
    const fields = fieldsContainer?.querySelectorAll('input');
    
    if (defineTypes?.checked) {
        fieldsContainer?.classList.remove('disabled');
        fields?.forEach(field => field.disabled = false);
    } else {
        fieldsContainer?.classList.add('disabled');
        fields?.forEach(field => field.disabled = true);
    }
    
    // Trigger config update
    if (typeof updateConfigOutput === 'function') {
        updateConfigOutput();
    }
}

// Module Selector Dropdown handling
const moduleSelect = document.getElementById('builder-module-select');
const moduleStatus = document.getElementById('module-status');
const builderContents = document.querySelectorAll('.builder-content');

// Modules with available builders
const availableModules = ['stableRequest', 'stableFunction', 'StableBuffer'];
const premiumModules = ['stableApiGateway', 'stableWorkflow', 'stableWorkflowGraph', 'StableScheduler', 'DistributedInfra'];

function updateBuilderModule(selectedModule) {
    // Update status indicator
    if (premiumModules.includes(selectedModule)) {
        moduleStatus.textContent = '(Premium)';
        moduleStatus.classList.add('premium');
    } else {
        moduleStatus.textContent = '';
        moduleStatus.classList.remove('premium');
    }
    
    // Switch builder content
    builderContents.forEach(content => content.classList.remove('active'));
    const targetContent = document.getElementById('builder-' + selectedModule);
    if (targetContent) {
        targetContent.classList.add('active');
    } else if (selectedModule !== 'stableRequest') {
        // Show placeholder for unavailable modules
        const placeholder = document.getElementById('builder-placeholder');
        if (placeholder) placeholder.classList.add('active');
    }
}

if (moduleSelect) {
    moduleSelect.addEventListener('change', (e) => {
        updateBuilderModule(e.target.value);
    });
}

// Legacy Builder tab switching (keeping for backward compatibility)
const builderTabBtns = document.querySelectorAll('.builder-tab-btn');

builderTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.disabled) return;
        
        builderTabBtns.forEach(b => b.classList.remove('active'));
        builderContents.forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        const content = document.getElementById('builder-' + btn.dataset.builderTab);
        if (content) content.classList.add('active');
    });
});

// stableRequest Config Builder
let stableRequestFields = {};

function parseJson(str, field) {
    if (!str || !str.trim()) {
        if (field) field.classList.remove('invalid', 'valid');
        return null;
    }
    try {
        const result = JSON.parse(str);
        if (field) {
            field.classList.remove('invalid');
            field.classList.add('valid');
        }
        return result;
    } catch (e) {
        if (field) {
            field.classList.remove('valid');
            field.classList.add('invalid');
        }
        return null;
    }
}

// Validate function/arrow function syntax
function validateFunction(str, field) {
    if (!str || !str.trim()) {
        if (field) field.classList.remove('invalid', 'valid');
        return null;
    }
    
    const trimmed = str.trim();
    
    // Patterns for valid function syntax:
    // Arrow function: (params) => { } or (params) => expression or param => expression
    // Function expression: function(params) { } or function name(params) { }
    // Async variants: async (params) => { } or async function(params) { }
    
    const arrowFnPattern = /^(async\s+)?\(?[^)]*\)?\s*=>\s*[\s\S]+$/;
    const functionPattern = /^(async\s+)?function\s*\w*\s*\([^)]*\)\s*\{[\s\S]*\}$/;
    
    const isValid = arrowFnPattern.test(trimmed) || functionPattern.test(trimmed);
    
    if (field) {
        if (isValid) {
            field.classList.remove('invalid');
            field.classList.add('valid');
        } else {
            field.classList.remove('valid');
            field.classList.add('invalid');
        }
    }
    
    return isValid ? trimmed : null;
}

// Toggle pre-execution dependent fields based on hook content and validity
function togglePreExecutionFields() {
    const hookField = document.getElementById('sr-preExecution-hook');
    const dependentFields = document.getElementById('preExecutionDependentFields');
    const fields = dependentFields?.querySelectorAll('input, textarea');
    
    const hookValue = hookField?.value?.trim();
    
    // Only enable dependent fields if hook is provided AND valid
    let isValidHook = false;
    if (hookValue) {
        // Use validateFunction to check if it's a valid function (but don't apply classes yet)
        const arrowFnPattern = /^(async\s+)?\(?[^)]*\)?\s*=>\s*[\s\S]+$/;
        const functionPattern = /^(async\s+)?function\s*\w*\s*\([^)]*\)\s*\{[\s\S]*\}$/;
        isValidHook = arrowFnPattern.test(hookValue) || functionPattern.test(hookValue);
    }
    
    if (isValidHook) {
        dependentFields?.classList.remove('disabled');
        fields?.forEach(field => field.disabled = false);
    } else {
        dependentFields?.classList.add('disabled');
        fields?.forEach(field => field.disabled = true);
    }
    
    // Trigger config update
    if (typeof updateConfigOutput === 'function') {
        updateConfigOutput();
    }
}

function generateStableRequestConfig() {
    const config = { reqData: {} };
    const imports = ['stableRequest'];
    let needsEnums = false;
    
    // Default values from source code
    const defaults = {
        method: 'GET',
        protocol: 'https',
        path: '/',
        port: 443,
        attempts: 1,
        wait: 1000,
        maxAllowedWait: 60000,
        retryStrategy: 'fixed',
        jitter: 0,
        maxSerializableChars: 1000,
        trialModeReqFailureProbability: 0,
        trialModeRetryFailureProbability: 0,
        // Cache defaults
        cacheTtl: 300000,
        cacheMaxSize: 100,
        cacheCacheableStatusCodes: '200, 203, 204, 206, 300, 301, 404, 405, 410, 414, 501',
        // Circuit breaker optional field defaults
        cbSuccessThresholdPercentage: 50,
        cbHalfOpenMaxRequests: 5
    };
    
    // reqData
    if (stableRequestFields.hostname?.value) {
        config.reqData.hostname = stableRequestFields.hostname.value;
    }
    
    const method = stableRequestFields.method?.value;
    if (method && method !== defaults.method) {
        config.reqData.method = `REQUEST_METHODS.${method}`;
        imports.push('REQUEST_METHODS');
        needsEnums = true;
    }
    
    const protocol = stableRequestFields.protocol?.value;
    if (protocol && protocol !== defaults.protocol) {
        config.reqData.protocol = `VALID_REQUEST_PROTOCOLS.${protocol.toUpperCase()}`;
        imports.push('VALID_REQUEST_PROTOCOLS');
        needsEnums = true;
    }
    
    const path = stableRequestFields.path?.value;
    // Path field no longer includes leading /, so prepend it
    const fullPath = path ? '/' + path : '/';
    if (fullPath !== defaults.path) {
        config.reqData.path = fullPath;
    }
    
    const port = parseInt(stableRequestFields.port?.value);
    if (!isNaN(port) && port !== defaults.port) {
        config.reqData.port = port;
    }
    
    const headers = parseJson(stableRequestFields.headers?.value, stableRequestFields.headers);
    if (headers) config.reqData.headers = headers;
    
    const body = parseJson(stableRequestFields.body?.value, stableRequestFields.body);
    if (body) config.reqData.body = body;
    
    const query = parseJson(stableRequestFields.query?.value, stableRequestFields.query);
    if (query) config.reqData.query = query;
    
    if (stableRequestFields.timeout?.value) {
        config.reqData.timeout = parseInt(stableRequestFields.timeout.value);
    }
    
    // Response options
    if (stableRequestFields.resReq?.checked) {
        config.resReq = true;
    }
    
    const responseAnalyzer = validateFunction(stableRequestFields.responseAnalyzer?.value, stableRequestFields.responseAnalyzer);
    if (responseAnalyzer) {
        config.responseAnalyzer = responseAnalyzer;
    }
    
    const finalErrorAnalyzer = validateFunction(stableRequestFields.finalErrorAnalyzer?.value, stableRequestFields.finalErrorAnalyzer);
    if (finalErrorAnalyzer) {
        config.finalErrorAnalyzer = finalErrorAnalyzer;
    }
    
    // Retry config - only include if different from defaults
    const attempts = parseInt(stableRequestFields.attempts?.value);
    if (!isNaN(attempts) && attempts !== defaults.attempts) {
        config.attempts = attempts;
    }
    
    const retryStrategy = stableRequestFields.retryStrategy?.value?.toLowerCase();
    if (retryStrategy && retryStrategy !== defaults.retryStrategy) {
        config.retryStrategy = `RETRY_STRATEGIES.${retryStrategy.toUpperCase()}`;
        imports.push('RETRY_STRATEGIES');
        needsEnums = true;
    }
    
    const wait = parseInt(stableRequestFields.wait?.value);
    if (!isNaN(wait) && wait !== defaults.wait) {
        config.wait = wait;
    }
    
    const maxAllowedWait = parseInt(stableRequestFields.maxAllowedWait?.value);
    if (!isNaN(maxAllowedWait) && maxAllowedWait !== defaults.maxAllowedWait) {
        config.maxAllowedWait = maxAllowedWait;
    }
    
    const jitter = parseInt(stableRequestFields.jitter?.value);
    if (!isNaN(jitter) && jitter !== defaults.jitter) {
        config.jitter = jitter;
    }
    
    if (stableRequestFields.performAllAttempts?.checked) {
        config.performAllAttempts = true;
    }
    
    if (stableRequestFields.throwOnFailedErrorAnalysis?.checked) {
        config.throwOnFailedErrorAnalysis = true;
    }
    
    // Observability
    if (stableRequestFields.logAllErrors?.checked) {
        config.logAllErrors = true;
    }
    
    if (stableRequestFields.logAllSuccessfulAttempts?.checked) {
        config.logAllSuccessfulAttempts = true;
    }
    
    const handleErrors = validateFunction(stableRequestFields.handleErrors?.value, stableRequestFields.handleErrors);
    if (handleErrors) {
        config.handleErrors = handleErrors;
    }
    
    const handleSuccessfulAttemptData = validateFunction(stableRequestFields.handleSuccessfulAttemptData?.value, stableRequestFields.handleSuccessfulAttemptData);
    if (handleSuccessfulAttemptData) {
        config.handleSuccessfulAttemptData = handleSuccessfulAttemptData;
    }
    
    const maxSerializableChars = parseInt(stableRequestFields.maxSerializableChars?.value);
    if (!isNaN(maxSerializableChars) && maxSerializableChars !== defaults.maxSerializableChars) {
        config.maxSerializableChars = maxSerializableChars;
    }
    
    // Cache - only include values different from defaults
    if (stableRequestFields.cacheEnabled?.checked) {
        config.cache = { enabled: true };
        
        const cacheTtl = parseInt(stableRequestFields.cacheTtl?.value);
        if (!isNaN(cacheTtl) && cacheTtl !== defaults.cacheTtl) {
            config.cache.ttl = cacheTtl;
        }
        
        const cacheMaxSize = parseInt(stableRequestFields.cacheMaxSize?.value);
        if (!isNaN(cacheMaxSize) && cacheMaxSize !== defaults.cacheMaxSize) {
            config.cache.maxSize = cacheMaxSize;
        }
        
        // respectCacheControl defaults to true in source, so only show if explicitly unchecked
        // Since checkbox unchecked = false, we show it when user wants to disable it
        if (stableRequestFields.cacheRespectCacheControl?.checked) {
            // This matches default (true), don't include
        } else if (stableRequestFields.cacheRespectCacheControl) {
            // User explicitly left it unchecked, meaning false
            config.cache.respectCacheControl = false;
        }
        
        // Only include status codes if different from default
        const statusCodesValue = stableRequestFields.cacheCacheableStatusCodes?.value?.trim();
        if (statusCodesValue && statusCodesValue !== defaults.cacheCacheableStatusCodes) {
            const codes = statusCodesValue
                .split(',')
                .map(s => parseInt(s.trim()))
                .filter(n => !isNaN(n));
            if (codes.length) config.cache.cacheableStatusCodes = codes;
        }
        
        // excludeMethods - default is [POST, PUT, PATCH, DELETE], so show if different
        const excludeMethods = [];
        if (stableRequestFields.cacheExcludeGET?.checked) excludeMethods.push('REQUEST_METHODS.GET');
        if (stableRequestFields.cacheExcludePOST?.checked) excludeMethods.push('REQUEST_METHODS.POST');
        if (stableRequestFields.cacheExcludePUT?.checked) excludeMethods.push('REQUEST_METHODS.PUT');
        if (stableRequestFields.cacheExcludePATCH?.checked) excludeMethods.push('REQUEST_METHODS.PATCH');
        if (stableRequestFields.cacheExcludeDELETE?.checked) excludeMethods.push('REQUEST_METHODS.DELETE');
        if (excludeMethods.length) {
            config.cache.excludeMethods = excludeMethods;
            if (!imports.includes('REQUEST_METHODS')) imports.push('REQUEST_METHODS');
            needsEnums = true;
        }
        
        const cacheKeyGenerator = validateFunction(stableRequestFields.cacheKeyGenerator?.value, stableRequestFields.cacheKeyGenerator);
        if (cacheKeyGenerator) {
            config.cache.keyGenerator = cacheKeyGenerator;
        }
    }
    
    // Circuit Breaker - only include if ALL required fields are provided
    const cbFailureThreshold = stableRequestFields.cbFailureThresholdPercentage?.value;
    const cbMinRequests = stableRequestFields.cbMinimumRequests?.value;
    const cbRecoveryTimeout = stableRequestFields.cbRecoveryTimeoutMs?.value;
    
    // Only create circuit breaker config if ALL required fields are provided
    if (cbFailureThreshold && cbMinRequests && cbRecoveryTimeout) {
        config.circuitBreaker = {
            failureThresholdPercentage: parseInt(cbFailureThreshold),
            minimumRequests: parseInt(cbMinRequests),
            recoveryTimeoutMs: parseInt(cbRecoveryTimeout)
        };
        
        // Optional fields - only include if different from defaults
        const halfOpenMax = parseInt(stableRequestFields.cbHalfOpenMaxRequests?.value);
        if (!isNaN(halfOpenMax) && halfOpenMax !== defaults.cbHalfOpenMaxRequests) {
            config.circuitBreaker.halfOpenMaxRequests = halfOpenMax;
        }
        
        const successThreshold = parseInt(stableRequestFields.cbSuccessThresholdPercentage?.value);
        if (!isNaN(successThreshold) && successThreshold !== defaults.cbSuccessThresholdPercentage) {
            config.circuitBreaker.successThresholdPercentage = successThreshold;
        }
        
        if (stableRequestFields.cbTrackIndividualAttempts?.checked) {
            config.circuitBreaker.trackIndividualAttempts = true;
        }
    }
    
    // Common Buffer - Initial state is always used, StableBuffer wraps it if selected
    let useStableBufferInCode = false;
    const initialState = parseJson(stableRequestFields.bufferInitialState?.value, stableRequestFields.bufferInitialState);
    
    if (stableRequestFields.useStableBuffer?.checked) {
        // User wants to create a StableBuffer - we'll generate the code for it
        useStableBufferInCode = true;
        imports.push('StableBuffer');
    } else if (initialState) {
        // Use plain buffer object
        config.commonBuffer = initialState;
    }
    
    // Metrics Guardrails
    const hasGuardrails = stableRequestFields.mgTotalAttemptsMax?.value ||
                          stableRequestFields.mgSuccessfulAttemptsMin?.value ||
                          stableRequestFields.mgFailedAttemptsMax?.value ||
                          stableRequestFields.mgTotalExecutionTimeMax?.value ||
                          stableRequestFields.mgAverageAttemptTimeMax?.value ||
                          stableRequestFields.mgCbFailureRateMax?.value ||
                          stableRequestFields.mgCbTotalRequestsMax?.value ||
                          stableRequestFields.mgCbFailedRequestsMax?.value ||
                          stableRequestFields.mgCacheHitRateMin?.value ||
                          stableRequestFields.mgCacheMissRateMax?.value ||
                          stableRequestFields.mgCacheUtilizationMax?.value ||
                          stableRequestFields.mgCacheEvictionRateMax?.value;
    
    if (hasGuardrails) {
        config.metricsGuardrails = {};
        
        const hasRequestMetrics = stableRequestFields.mgTotalAttemptsMax?.value ||
                                  stableRequestFields.mgSuccessfulAttemptsMin?.value ||
                                  stableRequestFields.mgFailedAttemptsMax?.value ||
                                  stableRequestFields.mgTotalExecutionTimeMax?.value ||
                                  stableRequestFields.mgAverageAttemptTimeMax?.value;
        if (hasRequestMetrics) {
            config.metricsGuardrails.request = {};
            if (stableRequestFields.mgTotalAttemptsMax?.value) {
                config.metricsGuardrails.request.totalAttempts = { max: parseInt(stableRequestFields.mgTotalAttemptsMax.value) };
            }
            if (stableRequestFields.mgSuccessfulAttemptsMin?.value) {
                config.metricsGuardrails.request.successfulAttempts = { min: parseInt(stableRequestFields.mgSuccessfulAttemptsMin.value) };
            }
            if (stableRequestFields.mgFailedAttemptsMax?.value) {
                config.metricsGuardrails.request.failedAttempts = { max: parseInt(stableRequestFields.mgFailedAttemptsMax.value) };
            }
            if (stableRequestFields.mgTotalExecutionTimeMax?.value) {
                config.metricsGuardrails.request.totalExecutionTime = { max: parseInt(stableRequestFields.mgTotalExecutionTimeMax.value) };
            }
            if (stableRequestFields.mgAverageAttemptTimeMax?.value) {
                config.metricsGuardrails.request.averageAttemptTime = { max: parseInt(stableRequestFields.mgAverageAttemptTimeMax.value) };
            }
        }
        
        const hasCbMetrics = stableRequestFields.mgCbFailureRateMax?.value ||
                            stableRequestFields.mgCbTotalRequestsMax?.value ||
                            stableRequestFields.mgCbFailedRequestsMax?.value;
        const hasCacheMetrics = stableRequestFields.mgCacheHitRateMin?.value ||
                               stableRequestFields.mgCacheMissRateMax?.value ||
                               stableRequestFields.mgCacheUtilizationMax?.value ||
                               stableRequestFields.mgCacheEvictionRateMax?.value;
        
        if (hasCbMetrics || hasCacheMetrics) {
            config.metricsGuardrails.infrastructure = {};
            if (hasCbMetrics) {
                config.metricsGuardrails.infrastructure.circuitBreaker = {};
                if (stableRequestFields.mgCbFailureRateMax?.value) {
                    config.metricsGuardrails.infrastructure.circuitBreaker.failureRate = { max: parseFloat(stableRequestFields.mgCbFailureRateMax.value) };
                }
                if (stableRequestFields.mgCbTotalRequestsMax?.value) {
                    config.metricsGuardrails.infrastructure.circuitBreaker.totalRequests = { max: parseInt(stableRequestFields.mgCbTotalRequestsMax.value) };
                }
                if (stableRequestFields.mgCbFailedRequestsMax?.value) {
                    config.metricsGuardrails.infrastructure.circuitBreaker.failedRequests = { max: parseInt(stableRequestFields.mgCbFailedRequestsMax.value) };
                }
            }
            if (hasCacheMetrics) {
                config.metricsGuardrails.infrastructure.cache = {};
                if (stableRequestFields.mgCacheHitRateMin?.value) {
                    config.metricsGuardrails.infrastructure.cache.hitRate = { min: parseFloat(stableRequestFields.mgCacheHitRateMin.value) };
                }
                if (stableRequestFields.mgCacheMissRateMax?.value) {
                    config.metricsGuardrails.infrastructure.cache.missRate = { max: parseFloat(stableRequestFields.mgCacheMissRateMax.value) };
                }
                if (stableRequestFields.mgCacheUtilizationMax?.value) {
                    config.metricsGuardrails.infrastructure.cache.utilizationPercentage = { max: parseInt(stableRequestFields.mgCacheUtilizationMax.value) };
                }
                if (stableRequestFields.mgCacheEvictionRateMax?.value) {
                    config.metricsGuardrails.infrastructure.cache.evictionRate = { max: parseFloat(stableRequestFields.mgCacheEvictionRateMax.value) };
                }
            }
        }
    }
    
    // Pre-Execution
    const preExecutionHook = validateFunction(stableRequestFields.preExecutionHook?.value, stableRequestFields.preExecutionHook);
    if (preExecutionHook) {
        config.preExecution = {
            preExecutionHook: preExecutionHook
        };
        
        const preParams = parseJson(stableRequestFields.preExecutionParams?.value, stableRequestFields.preExecutionParams);
        if (preParams) config.preExecution.preExecutionHookParams = preParams;
        
        if (stableRequestFields.preExecutionApplyOverride?.checked) {
            config.preExecution.applyPreExecutionConfigOverride = true;
        }
        
        if (stableRequestFields.preExecutionContinueOnFailure?.checked) {
            config.preExecution.continueOnPreExecutionHookFailure = true;
        }
    }
    
    // Trial Mode
    if (stableRequestFields.trialModeEnabled?.checked) {
        config.trialMode = {
            enabled: true
        };
        const reqFailProb = parseFloat(stableRequestFields.trialModeReqFailureProbability?.value);
        const retryFailProb = parseFloat(stableRequestFields.trialModeRetryFailureProbability?.value);
        if (!isNaN(reqFailProb) && reqFailProb > 0) {
            config.trialMode.reqFailureProbability = reqFailProb;
        }
        if (!isNaN(retryFailProb) && retryFailProb > 0) {
            config.trialMode.retryFailureProbability = retryFailProb;
        }
    }
    
    // Execution Context
    const hasEc = stableRequestFields.ecWorkflowId?.value ||
                  stableRequestFields.ecPhaseId?.value ||
                  stableRequestFields.ecBranchId?.value ||
                  stableRequestFields.ecRequestId?.value;
    
    if (hasEc) {
        config.executionContext = {};
        if (stableRequestFields.ecWorkflowId?.value) config.executionContext.workflowId = stableRequestFields.ecWorkflowId.value;
        if (stableRequestFields.ecPhaseId?.value) config.executionContext.phaseId = stableRequestFields.ecPhaseId.value;
        if (stableRequestFields.ecBranchId?.value) config.executionContext.branchId = stableRequestFields.ecBranchId.value;
        if (stableRequestFields.ecRequestId?.value) config.executionContext.requestId = stableRequestFields.ecRequestId.value;
    }

    // Transaction Logs
    const loadTransactionLogs = validateFunction(stableRequestFields.loadTransactionLogs?.value, stableRequestFields.loadTransactionLogs);
    if (loadTransactionLogs) config.loadTransactionLogs = loadTransactionLogs;

    const transactionLogs = parseJson(stableRequestFields.transactionLogs?.value, stableRequestFields.transactionLogs);
    if (transactionLogs !== null) config.transactionLogs = transactionLogs;
    
    // Hook Params - Build from individual fields
    const hookParams = {};
    const raParams = parseJson(stableRequestFields.hookParamsResponseAnalyzer?.value, stableRequestFields.hookParamsResponseAnalyzer);
    const hsParams = parseJson(stableRequestFields.hookParamsHandleSuccess?.value, stableRequestFields.hookParamsHandleSuccess);
    const heParams = parseJson(stableRequestFields.hookParamsHandleErrors?.value, stableRequestFields.hookParamsHandleErrors);
    const feParams = parseJson(stableRequestFields.hookParamsFinalErrorAnalyzer?.value, stableRequestFields.hookParamsFinalErrorAnalyzer);
    
    if (raParams) hookParams.responseAnalyzerParams = raParams;
    if (hsParams) hookParams.handleSuccessfulAttemptDataParams = hsParams;
    if (heParams) hookParams.handleErrorsParams = heParams;
    if (feParams) hookParams.finalErrorAnalyzerParams = feParams;
    
    if (Object.keys(hookParams).length > 0) config.hookParams = hookParams;
    
    // Build StableBuffer options if enabled
    let stableBufferOptions = null;
    if (useStableBufferInCode) {
        stableBufferOptions = {};
        if (initialState) stableBufferOptions.initialState = initialState;
        
        const timeoutMs = parseInt(stableRequestFields.bufferTransactionTimeoutMs?.value);
        if (!isNaN(timeoutMs) && timeoutMs > 0) {
            stableBufferOptions.transactionTimeoutMs = timeoutMs;
        }
        
        // Check for custom clone function
        const customCloneFn = validateFunction(stableRequestFields.bufferCloneFn?.value, stableRequestFields.bufferCloneFn);
        if (customCloneFn) {
            stableBufferOptions.clone = customCloneFn;
        }
        
        // Check for custom log function (directly from the textarea)
        const customLogFn = validateFunction(stableRequestFields.bufferLogTransactionFn?.value, stableRequestFields.bufferLogTransactionFn);
        if (customLogFn) {
            stableBufferOptions.logTransaction = customLogFn;
        }
        
        // StableBuffer metrics guardrails
        const hasBufferGuardrails = stableRequestFields.bufferMgTotalTransactionsMax?.value ||
                                    stableRequestFields.bufferMgAvgQueueWaitMax?.value;
        
        if (hasBufferGuardrails) {
            stableBufferOptions.metricsGuardrails = {};
            if (stableRequestFields.bufferMgTotalTransactionsMax?.value) {
                stableBufferOptions.metricsGuardrails.totalTransactions = { max: parseInt(stableRequestFields.bufferMgTotalTransactionsMax.value) };
            }
            if (stableRequestFields.bufferMgAvgQueueWaitMax?.value) {
                stableBufferOptions.metricsGuardrails.averageQueueWaitMs = { max: parseInt(stableRequestFields.bufferMgAvgQueueWaitMax.value) };
            }
        }
    }
    
    // TypeScript Generics
    const genericsInfo = {
        requestType: stableRequestFields.genericRequestType?.value?.trim() || null,
        responseType: stableRequestFields.genericResponseType?.value?.trim() || null,
        defineTypes: stableRequestFields.genericDefineTypes?.checked || false,
        requestTypeName: stableRequestFields.genericRequestName?.value?.trim() || 'RequestData',
        responseTypeName: stableRequestFields.genericResponseName?.value?.trim() || 'ResponseData'
    };
    
    return { config, imports: [...new Set(imports)], needsEnums, stableBufferOptions, genericsInfo };
}

function formatConfigValue(value, indent = 2, currentIndent = 0) {
    const spaces = ' '.repeat(currentIndent);
    const nextSpaces = ' '.repeat(currentIndent + indent);
    
    if (typeof value === 'string') {
        // Check if it's a function, enum reference, or variable reference
        if (value.startsWith('REQUEST_METHODS.') || 
            value.startsWith('RETRY_STRATEGIES.') ||
            value.startsWith('VALID_REQUEST_PROTOCOLS.') ||
            value.includes('=>') ||
            value.includes('function') ||
            value === 'buffer') {
            return value;
        }
        return `'${value.replace(/'/g, "\\'")}'`;
    }
    
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    
    if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        const items = value.map(v => formatConfigValue(v, indent, currentIndent + indent));
        if (value.every(v => typeof v !== 'object')) {
            return `[${items.join(', ')}]`;
        }
        return `[\n${nextSpaces}${items.join(`,\n${nextSpaces}`)}\n${spaces}]`;
    }
    
    if (typeof value === 'object' && value !== null) {
        const entries = Object.entries(value);
        if (entries.length === 0) return '{}';
        
        const lines = entries.map(([k, v]) => {
            const formattedValue = formatConfigValue(v, indent, currentIndent + indent);
            return `${nextSpaces}${k}: ${formattedValue}`;
        });
        
        return `{\n${lines.join(',\n')}\n${spaces}}`;
    }
    
    return String(value);
}

function generateCode() {
    const { config, imports, needsEnums, stableBufferOptions, genericsInfo } = generateStableRequestConfig();
    
    // Check if anything beyond the empty reqData object is configured
    const hasHostname = config.reqData.hostname;
    const hasOtherReqData = Object.keys(config.reqData).length > (hasHostname ? 1 : 0);
    const hasOtherConfig = Object.keys(config).length > 1; // More than just reqData
    const hasStableBuffer = stableBufferOptions !== null;
    const hasGenerics = genericsInfo.requestType || genericsInfo.responseType;
    
    // Build generic type string
    let genericTypeStr = '';
    let typeDefinitions = '';
    
    if (hasGenerics) {
        const reqType = genericsInfo.defineTypes && genericsInfo.requestType
            ? genericsInfo.requestTypeName
            : (genericsInfo.requestType || 'any');
        const resType = genericsInfo.defineTypes && genericsInfo.responseType
            ? genericsInfo.responseTypeName
            : (genericsInfo.responseType || 'any');
        
        genericTypeStr = `<${reqType}, ${resType}>`;
        
        // Generate interface definitions if requested
        if (genericsInfo.defineTypes) {
            if (genericsInfo.requestType) {
                typeDefinitions += `interface ${genericsInfo.requestTypeName} ${genericsInfo.requestType}\n\n`;
            }
            if (genericsInfo.responseType) {
                typeDefinitions += `interface ${genericsInfo.responseTypeName} ${genericsInfo.responseType}\n\n`;
            }
        }
    }
    
    if (!hasHostname) {
        // Just show a warning comment when hostname is empty
        return `// ⚠️ Hostname is required to generate a valid stableRequest configuration.
// Please enter a hostname in the Request Data section.`;
    }
    
    let importLine = `import { ${imports.join(', ')} } from '@emmvish/stable-infra';`;
    
    // Generate StableBuffer code if enabled
    let bufferCode = '';
    if (hasStableBuffer) {
        const bufferOptionsStr = Object.keys(stableBufferOptions).length > 0 
            ? formatConfigValue(stableBufferOptions, 2, 2)
            : '';
        bufferCode = bufferOptionsStr 
            ? `\n  const buffer = new StableBuffer(${bufferOptionsStr});\n`
            : `\n  const buffer = new StableBuffer();\n`;
        
        // Add commonBuffer reference to config
        config.commonBuffer = 'buffer';
    }
    
    // Format the config object with extra indent for IIFE
    const configStr = formatConfigValue(config, 2, 2);
    
    return `${importLine}
${typeDefinitions}
(async () => {${bufferCode}
  const result = await stableRequest${genericTypeStr}(${configStr});

  // Handle the result
  if (result.success) {
    console.log('Success:', result.data);
    console.log('Metrics:', result.metrics);
  } else {
    console.error('Failed:', result.error);
    console.log('Error logs:', result.errorLogs);
  }
})();`;
}

function updateConfigOutput() {
    const outputCode = document.getElementById('config-output-code');
    if (outputCode) {
        try {
            const code = generateCode();
            outputCode.textContent = code;
        } catch (e) {
            // Silently handle errors
        }
    }
}

function copyGeneratedCode() {
    const code = document.getElementById('config-output-code')?.textContent;
    if (code) {
        navigator.clipboard.writeText(code).then(() => {
            // Show feedback
            const btn = document.querySelector('.output-actions .btn-icon');
            if (btn) {
                btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
                setTimeout(() => {
                    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
                }, 2000);
            }
        });
    }
}

function resetConfigBuilder() {
    // Reset all fields
    Object.values(stableRequestFields).forEach(field => {
        if (!field) return;
        if (field.type === 'checkbox') {
            field.checked = false;
        } else if (field.tagName === 'SELECT') {
            field.selectedIndex = 0;
        } else {
            field.value = '';
            field.classList.remove('valid', 'invalid');
        }
    });
    
    // Re-apply defaults
    setDefaultValues();
    
    // Reset conditional fields states
    toggleCommonBufferFields();
    toggleStableBufferFields();
    toggleCacheFields();
    toggleTrialModeFields();
    togglePreExecutionFields();
    toggleTypeDefinitions();
    toggleObservabilityHook('errors');
    toggleObservabilityHook('success');
    
    updateConfigOutput();
}

// Initialize config builder when ready
function initConfigBuilder() {
    // Initialize field references after DOM is ready
    stableRequestFields = {
        // TypeScript Generics
        genericRequestType: document.getElementById('sr-generic-request'),
        genericResponseType: document.getElementById('sr-generic-response'),
        genericDefineTypes: document.getElementById('sr-generic-define-types'),
        genericRequestName: document.getElementById('sr-generic-request-name'),
        genericResponseName: document.getElementById('sr-generic-response-name'),
        
        // Request Data
        hostname: document.getElementById('sr-hostname'),
        path: document.getElementById('sr-path'),
        method: document.getElementById('sr-method'),
        protocol: document.getElementById('sr-protocol'),
        port: document.getElementById('sr-port'),
        headers: document.getElementById('sr-headers'),
        body: document.getElementById('sr-body'),
        query: document.getElementById('sr-query'),
        timeout: document.getElementById('sr-timeout'),
        
        // Retry
        attempts: document.getElementById('sr-attempts'),
        retryStrategy: document.getElementById('sr-retryStrategy'),
        wait: document.getElementById('sr-wait'),
        maxAllowedWait: document.getElementById('sr-maxAllowedWait'),
        jitter: document.getElementById('sr-jitter'),
        performAllAttempts: document.getElementById('sr-performAllAttempts'),
        throwOnFailedErrorAnalysis: document.getElementById('sr-throwOnFailedErrorAnalysis'),
        
        // Response
        resReq: document.getElementById('sr-resReq'),
        responseAnalyzer: document.getElementById('sr-responseAnalyzer'),
        finalErrorAnalyzer: document.getElementById('sr-finalErrorAnalyzer'),
        
        // Observability
        logAllErrors: document.getElementById('sr-logAllErrors'),
        logAllSuccessfulAttempts: document.getElementById('sr-logAllSuccessfulAttempts'),
        handleErrors: document.getElementById('sr-handleErrors'),
        handleSuccessfulAttemptData: document.getElementById('sr-handleSuccessfulAttemptData'),
        maxSerializableChars: document.getElementById('sr-maxSerializableChars'),
        
        // Cache
        cacheEnabled: document.getElementById('sr-cache-enabled'),
        cacheRespectCacheControl: document.getElementById('sr-cache-respectCacheControl'),
        cacheTtl: document.getElementById('sr-cache-ttl'),
        cacheMaxSize: document.getElementById('sr-cache-maxSize'),
        cacheCacheableStatusCodes: document.getElementById('sr-cache-cacheableStatusCodes'),
        cacheExcludePOST: document.getElementById('sr-cache-excludePOST'),
        cacheExcludeGET: document.getElementById('sr-cache-excludeGET'),
        cacheExcludePUT: document.getElementById('sr-cache-excludePUT'),
        cacheExcludePATCH: document.getElementById('sr-cache-excludePATCH'),
        cacheExcludeDELETE: document.getElementById('sr-cache-excludeDELETE'),
        cacheKeyGenerator: document.getElementById('sr-cache-keyGenerator'),
        
        // Circuit Breaker
        cbFailureThresholdPercentage: document.getElementById('sr-cb-failureThresholdPercentage'),
        cbMinimumRequests: document.getElementById('sr-cb-minimumRequests'),
        cbRecoveryTimeoutMs: document.getElementById('sr-cb-recoveryTimeoutMs'),
        cbHalfOpenMaxRequests: document.getElementById('sr-cb-halfOpenMaxRequests'),
        cbSuccessThresholdPercentage: document.getElementById('sr-cb-successThresholdPercentage'),
        cbTrackIndividualAttempts: document.getElementById('sr-cb-trackIndividualAttempts'),
        
        // Buffer
        useStableBuffer: document.getElementById('sr-useStableBuffer'),
        bufferInitialState: document.getElementById('sr-buffer-initialState'),
        bufferTransactionTimeoutMs: document.getElementById('sr-buffer-transactionTimeoutMs'),
        bufferCloneFn: document.getElementById('sr-buffer-clone'),
        bufferLogTransactionFn: document.getElementById('sr-buffer-logTransactionFn'),
        bufferMgTotalTransactionsMax: document.getElementById('sr-buffer-mg-totalTransactions-max'),
        bufferMgAvgQueueWaitMax: document.getElementById('sr-buffer-mg-avgQueueWait-max'),
        
        // Guardrails - Request Metrics
        mgTotalAttemptsMax: document.getElementById('sr-mg-totalAttempts-max'),
        mgSuccessfulAttemptsMin: document.getElementById('sr-mg-successfulAttempts-min'),
        mgFailedAttemptsMax: document.getElementById('sr-mg-failedAttempts-max'),
        mgTotalExecutionTimeMax: document.getElementById('sr-mg-totalExecutionTime-max'),
        mgAverageAttemptTimeMax: document.getElementById('sr-mg-averageAttemptTime-max'),
        // Guardrails - Circuit Breaker
        mgCbFailureRateMax: document.getElementById('sr-mg-cb-failureRate-max'),
        mgCbTotalRequestsMax: document.getElementById('sr-mg-cb-totalRequests-max'),
        mgCbFailedRequestsMax: document.getElementById('sr-mg-cb-failedRequests-max'),
        // Guardrails - Cache
        mgCacheHitRateMin: document.getElementById('sr-mg-cache-hitRate-min'),
        mgCacheMissRateMax: document.getElementById('sr-mg-cache-missRate-max'),
        mgCacheUtilizationMax: document.getElementById('sr-mg-cache-utilizationPercentage-max'),
        mgCacheEvictionRateMax: document.getElementById('sr-mg-cache-evictionRate-max'),
        
        // Pre-Execution
        preExecutionHook: document.getElementById('sr-preExecution-hook'),
        preExecutionParams: document.getElementById('sr-preExecution-params'),
        preExecutionApplyOverride: document.getElementById('sr-preExecution-applyOverride'),
        preExecutionContinueOnFailure: document.getElementById('sr-preExecution-continueOnFailure'),
        
        // Trial Mode
        trialModeEnabled: document.getElementById('sr-trialMode-enabled'),
        trialModeReqFailureProbability: document.getElementById('sr-trialMode-reqFailureProbability'),
        trialModeRetryFailureProbability: document.getElementById('sr-trialMode-retryFailureProbability'),

        // Transaction Logs
        loadTransactionLogs: document.getElementById('sr-loadTransactionLogs'),
        transactionLogs: document.getElementById('sr-transactionLogs'),
        
        // Execution Context
        ecWorkflowId: document.getElementById('sr-ec-workflowId'),
        ecPhaseId: document.getElementById('sr-ec-phaseId'),
        ecBranchId: document.getElementById('sr-ec-branchId'),
        ecRequestId: document.getElementById('sr-ec-requestId'),
        
        // Hook Params - Individual fields
        hookParamsResponseAnalyzer: document.getElementById('sr-hookParams-responseAnalyzer'),
        hookParamsHandleSuccess: document.getElementById('sr-hookParams-handleSuccessfulAttemptData'),
        hookParamsHandleErrors: document.getElementById('sr-hookParams-handleErrors'),
        hookParamsFinalErrorAnalyzer: document.getElementById('sr-hookParams-finalErrorAnalyzer')
    };
    
    // Set default values (in case HTML value attributes weren't set)
    setDefaultValues();
    
    // Attach event listeners
    Object.entries(stableRequestFields).forEach(([name, field]) => {
        if (!field) return;
        field.addEventListener('input', updateConfigOutput);
        field.addEventListener('change', updateConfigOutput);
    });
    
    // Initial generation
    updateConfigOutput();
}

// Set default values for fields
function setDefaultValues() {
    const defaults = {
        hostname: 'localhost',
        port: '443',
        attempts: '1',
        wait: '1000',
        maxAllowedWait: '60000',
        jitter: '0',
        maxSerializableChars: '1000',
        cacheTtl: '300000',
        cacheMaxSize: '100',
        cacheCacheableStatusCodes: '200, 203, 204, 206, 300, 301, 404, 405, 410, 414, 501',
        cbHalfOpenMaxRequests: '5',
        cbSuccessThresholdPercentage: '50',
        bufferTransactionTimeoutMs: '0',
        trialModeReqFailureProbability: '0',
        trialModeRetryFailureProbability: '0',
        genericRequestName: 'RequestData',
        genericResponseName: 'ResponseData'
    };
    
    Object.entries(defaults).forEach(([fieldName, defaultValue]) => {
        const field = stableRequestFields[fieldName];
        if (field && !field.value) {
            field.value = defaultValue;
        }
    });
    
    // Set default for select fields
    if (stableRequestFields.method && !stableRequestFields.method.value) {
        stableRequestFields.method.value = 'GET';
    }
    if (stableRequestFields.protocol && !stableRequestFields.protocol.value) {
        stableRequestFields.protocol.value = 'https';
    }
    if (stableRequestFields.retryStrategy && !stableRequestFields.retryStrategy.value) {
        stableRequestFields.retryStrategy.value = 'fixed';
    }
    
    // Set default checkbox for cache control (should be checked by default)
    if (stableRequestFields.cacheRespectCacheControl) {
        stableRequestFields.cacheRespectCacheControl.checked = true;
    }
}

// ===== stableFunction Config Builder =====

let stableFunctionFields = {};

// Toggle stableFunction pre-execution fields
function toggleSfPreExecutionFields() {
    const hookField = document.getElementById('sf-preExecution-hook');
    const dependentFields = document.getElementById('sfPreExecutionDependentFields');
    const fields = dependentFields?.querySelectorAll('input, textarea');
    
    const hookValue = hookField?.value?.trim();
    let isValidHook = false;
    if (hookValue) {
        const arrowFnPattern = /^(async\s+)?\(?[^)]*\)?\s*=>\s*[\s\S]+$/;
        const functionPattern = /^(async\s+)?function\s*\w*\s*\([^)]*\)\s*\{[\s\S]*\}$/;
        isValidHook = arrowFnPattern.test(hookValue) || functionPattern.test(hookValue);
    }
    
    if (isValidHook) {
        dependentFields?.classList.remove('disabled');
        fields?.forEach(field => field.disabled = false);
    } else {
        dependentFields?.classList.add('disabled');
        fields?.forEach(field => field.disabled = true);
    }
    
    if (typeof updateSfConfigOutput === 'function') {
        updateSfConfigOutput();
    }
}

// Toggle stableFunction cache fields
function toggleSfCacheFields() {
    const cacheEnabled = document.getElementById('sf-cache-enabled');
    const fieldsContainer = document.getElementById('sfCacheConfigFields');
    const fields = fieldsContainer?.querySelectorAll('input, textarea');
    
    if (cacheEnabled?.checked) {
        fieldsContainer?.classList.remove('disabled');
        fields?.forEach(field => field.disabled = false);
    } else {
        fieldsContainer?.classList.add('disabled');
        fields?.forEach(field => field.disabled = true);
    }
    
    if (typeof updateSfConfigOutput === 'function') {
        updateSfConfigOutput();
    }
}

// Toggle stableFunction trial mode fields
function toggleSfTrialModeFields() {
    const trialModeEnabled = document.getElementById('sf-trialMode-enabled');
    const fieldsContainer = document.getElementById('sfTrialModeConfigFields');
    const fields = fieldsContainer?.querySelectorAll('input');
    
    if (trialModeEnabled?.checked) {
        fieldsContainer?.classList.remove('disabled');
        fields?.forEach(field => field.disabled = false);
    } else {
        fieldsContainer?.classList.add('disabled');
        fields?.forEach(field => field.disabled = true);
    }
    
    if (typeof updateSfConfigOutput === 'function') {
        updateSfConfigOutput();
    }
}

// Toggle stableFunction observability hook fields
function toggleSfObservabilityHook(type) {
    if (type === 'errors') {
        const logAllErrors = document.getElementById('sf-logAllErrors');
        const handleErrors = document.getElementById('sf-handleErrors');
        if (handleErrors) {
            handleErrors.disabled = !logAllErrors?.checked;
            if (!logAllErrors?.checked) {
                handleErrors.classList.add('field-disabled');
            } else {
                handleErrors.classList.remove('field-disabled');
            }
        }
    } else if (type === 'success') {
        const logAllSuccess = document.getElementById('sf-logAllSuccessfulAttempts');
        const handleSuccess = document.getElementById('sf-handleSuccessfulAttemptData');
        if (handleSuccess) {
            handleSuccess.disabled = !logAllSuccess?.checked;
            if (!logAllSuccess?.checked) {
                handleSuccess.classList.add('field-disabled');
            } else {
                handleSuccess.classList.remove('field-disabled');
            }
        }
    }
    
    if (typeof updateSfConfigOutput === 'function') {
        updateSfConfigOutput();
    }
}

// Toggle stableFunction Common Buffer dependent fields based on Initial State
function toggleSfCommonBufferFields() {
    const initialState = document.getElementById('sf-buffer-initialState');
    const dependentContainer = document.getElementById('sfCommonBufferDependentFields');
    const useStableBufferCheckbox = document.getElementById('sf-useStableBuffer');
    
    let hasValidInitialState = false;
    const value = initialState?.value?.trim();
    if (value) {
        try {
            JSON.parse(value);
            hasValidInitialState = true;
            initialState.style.borderColor = '';
        } catch (e) {
            initialState.style.borderColor = '#e74c3c';
        }
    } else {
        initialState.style.borderColor = '';
    }
    
    if (hasValidInitialState) {
        dependentContainer?.classList.remove('disabled');
        if (useStableBufferCheckbox) useStableBufferCheckbox.disabled = false;
    } else {
        dependentContainer?.classList.add('disabled');
        if (useStableBufferCheckbox) {
            useStableBufferCheckbox.disabled = true;
            useStableBufferCheckbox.checked = false;
        }
        toggleSfStableBufferFields();
    }
    
    if (typeof updateSfConfigOutput === 'function') {
        updateSfConfigOutput();
    }
}

// Toggle stableFunction StableBuffer configuration fields
function toggleSfStableBufferFields() {
    const useStableBuffer = document.getElementById('sf-useStableBuffer');
    const fieldsContainer = document.getElementById('sfStableBufferFields');
    const fields = fieldsContainer?.querySelectorAll('input, textarea');
    
    if (useStableBuffer?.checked) {
        fieldsContainer?.classList.remove('disabled');
        fields?.forEach(field => field.disabled = false);
    } else {
        fieldsContainer?.classList.add('disabled');
        fields?.forEach(field => field.disabled = true);
    }
    
    if (typeof updateSfConfigOutput === 'function') {
        updateSfConfigOutput();
    }
}

function generateStableFunctionConfig() {
    const config = {};
    const imports = ['stableFunction'];
    let needsEnums = false;
    
    const defaults = {
        attempts: 1,
        wait: 1000,
        maxAllowedWait: 60000,
        retryStrategy: 'fixed',
        jitter: 0,
        maxSerializableChars: 1000,
        cacheTtl: 300000,
        cacheMaxSize: 100,
        cbSuccessThresholdPercentage: 50,
        cbHalfOpenMaxRequests: 5
    };
    
    // Function (required)
    const fn = validateFunction(stableFunctionFields.fn?.value, stableFunctionFields.fn);
    if (fn) {
        config.fn = fn;
    }
    
    // Args (required)
    const args = parseJson(stableFunctionFields.args?.value, stableFunctionFields.args);
    if (args) {
        config.args = args;
    }
    
    // Return result
    if (stableFunctionFields.returnResult?.checked) {
        config.returnResult = true;
    }
    
    // Retry config
    const attempts = parseInt(stableFunctionFields.attempts?.value);
    if (!isNaN(attempts) && attempts !== defaults.attempts) {
        config.attempts = attempts;
    }
    
    const retryStrategy = stableFunctionFields.retryStrategy?.value?.toLowerCase();
    if (retryStrategy && retryStrategy !== defaults.retryStrategy) {
        config.retryStrategy = `RETRY_STRATEGIES.${retryStrategy.toUpperCase()}`;
        imports.push('RETRY_STRATEGIES');
        needsEnums = true;
    }
    
    const wait = parseInt(stableFunctionFields.wait?.value);
    if (!isNaN(wait) && wait !== defaults.wait) {
        config.wait = wait;
    }
    
    const maxAllowedWait = parseInt(stableFunctionFields.maxAllowedWait?.value);
    if (!isNaN(maxAllowedWait) && maxAllowedWait !== defaults.maxAllowedWait) {
        config.maxAllowedWait = maxAllowedWait;
    }
    
    const jitter = parseInt(stableFunctionFields.jitter?.value);
    if (!isNaN(jitter) && jitter !== defaults.jitter) {
        config.jitter = jitter;
    }
    
    if (stableFunctionFields.performAllAttempts?.checked) {
        config.performAllAttempts = true;
    }
    
    if (stableFunctionFields.throwOnFailedErrorAnalysis?.checked) {
        config.throwOnFailedErrorAnalysis = true;
    }
    
    // Timeout & Concurrency
    const executionTimeout = parseInt(stableFunctionFields.executionTimeout?.value);
    if (!isNaN(executionTimeout) && executionTimeout > 0) {
        config.executionTimeout = executionTimeout;
    }
    
    const maxConcurrentRequests = parseInt(stableFunctionFields.maxConcurrentRequests?.value);
    if (!isNaN(maxConcurrentRequests) && maxConcurrentRequests > 0) {
        config.maxConcurrentRequests = maxConcurrentRequests;
    }
    
    // Response analyzer
    const responseAnalyzer = validateFunction(stableFunctionFields.responseAnalyzer?.value, stableFunctionFields.responseAnalyzer);
    if (responseAnalyzer) {
        config.responseAnalyzer = responseAnalyzer;
    }
    
    // Final error analyzer
    const finalErrorAnalyzer = validateFunction(stableFunctionFields.finalErrorAnalyzer?.value, stableFunctionFields.finalErrorAnalyzer);
    if (finalErrorAnalyzer) {
        config.finalErrorAnalyzer = finalErrorAnalyzer;
    }
    
    // Observability
    if (stableFunctionFields.logAllErrors?.checked) {
        config.logAllErrors = true;
    }
    
    if (stableFunctionFields.logAllSuccessfulAttempts?.checked) {
        config.logAllSuccessfulAttempts = true;
    }
    
    const handleErrors = validateFunction(stableFunctionFields.handleErrors?.value, stableFunctionFields.handleErrors);
    if (handleErrors) {
        config.handleErrors = handleErrors;
    }
    
    const handleSuccessfulAttemptData = validateFunction(stableFunctionFields.handleSuccessfulAttemptData?.value, stableFunctionFields.handleSuccessfulAttemptData);
    if (handleSuccessfulAttemptData) {
        config.handleSuccessfulAttemptData = handleSuccessfulAttemptData;
    }
    
    const maxSerializableChars = parseInt(stableFunctionFields.maxSerializableChars?.value);
    if (!isNaN(maxSerializableChars) && maxSerializableChars !== defaults.maxSerializableChars) {
        config.maxSerializableChars = maxSerializableChars;
    }
    
    // Cache
    if (stableFunctionFields.cacheEnabled?.checked) {
        config.cache = { enabled: true };
        
        const cacheTtl = parseInt(stableFunctionFields.cacheTtl?.value);
        if (!isNaN(cacheTtl) && cacheTtl !== defaults.cacheTtl) {
            config.cache.ttl = cacheTtl;
        }
        
        const cacheMaxSize = parseInt(stableFunctionFields.cacheMaxSize?.value);
        if (!isNaN(cacheMaxSize) && cacheMaxSize !== defaults.cacheMaxSize) {
            config.cache.maxSize = cacheMaxSize;
        }
        
        const cacheKeyGenerator = validateFunction(stableFunctionFields.cacheKeyGenerator?.value, stableFunctionFields.cacheKeyGenerator);
        if (cacheKeyGenerator) {
            config.cache.keyGenerator = cacheKeyGenerator;
        }
    }
    
    // Circuit Breaker
    const cbFailureThreshold = stableFunctionFields.cbFailureThresholdPercentage?.value;
    const cbMinRequests = stableFunctionFields.cbMinimumRequests?.value;
    const cbRecoveryTimeout = stableFunctionFields.cbRecoveryTimeoutMs?.value;
    
    if (cbFailureThreshold && cbMinRequests && cbRecoveryTimeout) {
        config.circuitBreaker = {
            failureThresholdPercentage: parseInt(cbFailureThreshold),
            minimumRequests: parseInt(cbMinRequests),
            recoveryTimeoutMs: parseInt(cbRecoveryTimeout)
        };
        
        const halfOpenMax = parseInt(stableFunctionFields.cbHalfOpenMaxRequests?.value);
        if (!isNaN(halfOpenMax) && halfOpenMax !== defaults.cbHalfOpenMaxRequests) {
            config.circuitBreaker.halfOpenMaxRequests = halfOpenMax;
        }
        
        const successThreshold = parseInt(stableFunctionFields.cbSuccessThresholdPercentage?.value);
        if (!isNaN(successThreshold) && successThreshold !== defaults.cbSuccessThresholdPercentage) {
            config.circuitBreaker.successThresholdPercentage = successThreshold;
        }
        
        if (stableFunctionFields.cbTrackIndividualAttempts?.checked) {
            config.circuitBreaker.trackIndividualAttempts = true;
        }
    }
    
    // Rate Limiting
    const rateLimitMaxRequests = stableFunctionFields.rateLimitMaxRequests?.value;
    const rateLimitWindowMs = stableFunctionFields.rateLimitWindowMs?.value;
    
    if (rateLimitMaxRequests && rateLimitWindowMs) {
        config.rateLimit = {
            maxRequests: parseInt(rateLimitMaxRequests),
            windowMs: parseInt(rateLimitWindowMs)
        };
    }
    
    // Common Buffer - Initial state is always used, StableBuffer wraps it if selected
    let useSfStableBufferInCode = false;
    const sfInitialState = parseJson(stableFunctionFields.bufferInitialState?.value, stableFunctionFields.bufferInitialState);
    
    if (stableFunctionFields.useStableBuffer?.checked) {
        useSfStableBufferInCode = true;
        imports.push('StableBuffer');
    } else if (sfInitialState) {
        config.commonBuffer = sfInitialState;
    }
    
    // Build StableBuffer options if enabled
    let sfStableBufferOptions = null;
    if (useSfStableBufferInCode) {
        sfStableBufferOptions = {};
        if (sfInitialState) sfStableBufferOptions.initialState = sfInitialState;
        
        const timeoutMs = parseInt(stableFunctionFields.bufferTransactionTimeoutMs?.value);
        if (!isNaN(timeoutMs) && timeoutMs > 0) {
            sfStableBufferOptions.transactionTimeoutMs = timeoutMs;
        }
        
        const customCloneFn = validateFunction(stableFunctionFields.bufferCloneFn?.value, stableFunctionFields.bufferCloneFn);
        if (customCloneFn) {
            sfStableBufferOptions.clone = customCloneFn;
        }
        
        const customLogFn = validateFunction(stableFunctionFields.bufferLogTransactionFn?.value, stableFunctionFields.bufferLogTransactionFn);
        if (customLogFn) {
            sfStableBufferOptions.logTransaction = customLogFn;
        }
        
        const hasBufferGuardrails = stableFunctionFields.bufferMgTotalTransactionsMax?.value ||
                                    stableFunctionFields.bufferMgAvgQueueWaitMax?.value;
        
        if (hasBufferGuardrails) {
            sfStableBufferOptions.metricsGuardrails = {};
            if (stableFunctionFields.bufferMgTotalTransactionsMax?.value) {
                sfStableBufferOptions.metricsGuardrails.totalTransactions = { max: parseInt(stableFunctionFields.bufferMgTotalTransactionsMax.value) };
            }
            if (stableFunctionFields.bufferMgAvgQueueWaitMax?.value) {
                sfStableBufferOptions.metricsGuardrails.averageQueueWaitMs = { max: parseInt(stableFunctionFields.bufferMgAvgQueueWaitMax.value) };
            }
        }
    }
    
    // Pre-Execution
    const preExecutionHook = validateFunction(stableFunctionFields.preExecutionHook?.value, stableFunctionFields.preExecutionHook);
    if (preExecutionHook) {
        config.preExecution = {
            preExecutionHook: preExecutionHook
        };
        
        const preParams = parseJson(stableFunctionFields.preExecutionParams?.value, stableFunctionFields.preExecutionParams);
        if (preParams) config.preExecution.preExecutionHookParams = preParams;
        
        if (stableFunctionFields.preExecutionApplyOverride?.checked) {
            config.preExecution.applyPreExecutionConfigOverride = true;
        }
        
        if (stableFunctionFields.preExecutionContinueOnFailure?.checked) {
            config.preExecution.continueOnPreExecutionHookFailure = true;
        }
    }
    
    // Trial Mode
    if (stableFunctionFields.trialModeEnabled?.checked) {
        config.trialMode = { enabled: true };
        const execFailProb = parseFloat(stableFunctionFields.trialModeExecFailureProbability?.value);
        const retryFailProb = parseFloat(stableFunctionFields.trialModeRetryFailureProbability?.value);
        if (!isNaN(execFailProb) && execFailProb > 0) {
            config.trialMode.execFailureProbability = execFailProb;
        }
        if (!isNaN(retryFailProb) && retryFailProb > 0) {
            config.trialMode.retryFailureProbability = retryFailProb;
        }
    }
    
    // Execution Context
    const hasEc = stableFunctionFields.ecWorkflowId?.value ||
                  stableFunctionFields.ecPhaseId?.value ||
                  stableFunctionFields.ecBranchId?.value ||
                  stableFunctionFields.ecRequestId?.value;
    
    if (hasEc) {
        config.executionContext = {};
        if (stableFunctionFields.ecWorkflowId?.value) config.executionContext.workflowId = stableFunctionFields.ecWorkflowId.value;
        if (stableFunctionFields.ecPhaseId?.value) config.executionContext.phaseId = stableFunctionFields.ecPhaseId.value;
        if (stableFunctionFields.ecBranchId?.value) config.executionContext.branchId = stableFunctionFields.ecBranchId.value;
        if (stableFunctionFields.ecRequestId?.value) config.executionContext.requestId = stableFunctionFields.ecRequestId.value;
    }
    
    // Transaction Logs
    const loadTransactionLogs = validateFunction(stableFunctionFields.loadTransactionLogs?.value, stableFunctionFields.loadTransactionLogs);
    if (loadTransactionLogs) config.loadTransactionLogs = loadTransactionLogs;

    const transactionLogs = parseJson(stableFunctionFields.transactionLogs?.value, stableFunctionFields.transactionLogs);
    if (transactionLogs !== null) config.transactionLogs = transactionLogs;
    // Metrics Guardrails
    const hasGuardrails = stableFunctionFields.mgTotalAttemptsMax?.value ||
                          stableFunctionFields.mgSuccessfulAttemptsMin?.value ||
                          stableFunctionFields.mgFailedAttemptsMax?.value ||
                          stableFunctionFields.mgTotalExecutionTimeMax?.value ||
                          stableFunctionFields.mgAverageAttemptTimeMax?.value ||
                          stableFunctionFields.mgCbFailureRateMax?.value ||
                          stableFunctionFields.mgCbTotalRequestsMax?.value ||
                          stableFunctionFields.mgCbFailedRequestsMax?.value ||
                          stableFunctionFields.mgCacheHitRateMin?.value ||
                          stableFunctionFields.mgCacheMissRateMax?.value ||
                          stableFunctionFields.mgCacheUtilizationMax?.value ||
                          stableFunctionFields.mgCacheEvictionRateMax?.value ||
                          stableFunctionFields.mgRlThrottleRateMax?.value ||
                          stableFunctionFields.mgRlQueueLengthMax?.value ||
                          stableFunctionFields.mgRlUtilizationMax?.value ||
                          stableFunctionFields.mgRlAvgQueueWaitTimeMax?.value ||
                          stableFunctionFields.mgClUtilizationMax?.value ||
                          stableFunctionFields.mgClQueueLengthMax?.value ||
                          stableFunctionFields.mgClAvgQueueWaitTimeMax?.value;
    
    if (hasGuardrails) {
        config.metricsGuardrails = {};
        
        const hasRequestMetrics = stableFunctionFields.mgTotalAttemptsMax?.value ||
                                  stableFunctionFields.mgSuccessfulAttemptsMin?.value ||
                                  stableFunctionFields.mgFailedAttemptsMax?.value ||
                                  stableFunctionFields.mgTotalExecutionTimeMax?.value ||
                                  stableFunctionFields.mgAverageAttemptTimeMax?.value;
        if (hasRequestMetrics) {
            config.metricsGuardrails.request = {};
            if (stableFunctionFields.mgTotalAttemptsMax?.value) {
                config.metricsGuardrails.request.totalAttempts = { max: parseInt(stableFunctionFields.mgTotalAttemptsMax.value) };
            }
            if (stableFunctionFields.mgSuccessfulAttemptsMin?.value) {
                config.metricsGuardrails.request.successfulAttempts = { min: parseInt(stableFunctionFields.mgSuccessfulAttemptsMin.value) };
            }
            if (stableFunctionFields.mgFailedAttemptsMax?.value) {
                config.metricsGuardrails.request.failedAttempts = { max: parseInt(stableFunctionFields.mgFailedAttemptsMax.value) };
            }
            if (stableFunctionFields.mgTotalExecutionTimeMax?.value) {
                config.metricsGuardrails.request.totalExecutionTime = { max: parseInt(stableFunctionFields.mgTotalExecutionTimeMax.value) };
            }
            if (stableFunctionFields.mgAverageAttemptTimeMax?.value) {
                config.metricsGuardrails.request.averageAttemptTime = { max: parseInt(stableFunctionFields.mgAverageAttemptTimeMax.value) };
            }
        }
        
        const hasCbMetrics = stableFunctionFields.mgCbFailureRateMax?.value ||
                            stableFunctionFields.mgCbTotalRequestsMax?.value ||
                            stableFunctionFields.mgCbFailedRequestsMax?.value;
        const hasCacheMetrics = stableFunctionFields.mgCacheHitRateMin?.value ||
                               stableFunctionFields.mgCacheMissRateMax?.value ||
                               stableFunctionFields.mgCacheUtilizationMax?.value ||
                               stableFunctionFields.mgCacheEvictionRateMax?.value;
        const hasRlMetrics = stableFunctionFields.mgRlThrottleRateMax?.value ||
                            stableFunctionFields.mgRlQueueLengthMax?.value ||
                            stableFunctionFields.mgRlUtilizationMax?.value ||
                            stableFunctionFields.mgRlAvgQueueWaitTimeMax?.value;
        const hasClMetrics = stableFunctionFields.mgClUtilizationMax?.value ||
                            stableFunctionFields.mgClQueueLengthMax?.value ||
                            stableFunctionFields.mgClAvgQueueWaitTimeMax?.value;
        
        if (hasCbMetrics || hasCacheMetrics || hasRlMetrics || hasClMetrics) {
            config.metricsGuardrails.infrastructure = {};
            if (hasCbMetrics) {
                config.metricsGuardrails.infrastructure.circuitBreaker = {};
                if (stableFunctionFields.mgCbFailureRateMax?.value) {
                    config.metricsGuardrails.infrastructure.circuitBreaker.failureRate = { max: parseFloat(stableFunctionFields.mgCbFailureRateMax.value) };
                }
                if (stableFunctionFields.mgCbTotalRequestsMax?.value) {
                    config.metricsGuardrails.infrastructure.circuitBreaker.totalRequests = { max: parseInt(stableFunctionFields.mgCbTotalRequestsMax.value) };
                }
                if (stableFunctionFields.mgCbFailedRequestsMax?.value) {
                    config.metricsGuardrails.infrastructure.circuitBreaker.failedRequests = { max: parseInt(stableFunctionFields.mgCbFailedRequestsMax.value) };
                }
            }
            if (hasCacheMetrics) {
                config.metricsGuardrails.infrastructure.cache = {};
                if (stableFunctionFields.mgCacheHitRateMin?.value) {
                    config.metricsGuardrails.infrastructure.cache.hitRate = { min: parseFloat(stableFunctionFields.mgCacheHitRateMin.value) };
                }
                if (stableFunctionFields.mgCacheMissRateMax?.value) {
                    config.metricsGuardrails.infrastructure.cache.missRate = { max: parseFloat(stableFunctionFields.mgCacheMissRateMax.value) };
                }
                if (stableFunctionFields.mgCacheUtilizationMax?.value) {
                    config.metricsGuardrails.infrastructure.cache.utilizationPercentage = { max: parseInt(stableFunctionFields.mgCacheUtilizationMax.value) };
                }
                if (stableFunctionFields.mgCacheEvictionRateMax?.value) {
                    config.metricsGuardrails.infrastructure.cache.evictionRate = { max: parseFloat(stableFunctionFields.mgCacheEvictionRateMax.value) };
                }
            }
            if (hasRlMetrics) {
                config.metricsGuardrails.infrastructure.rateLimiter = {};
                if (stableFunctionFields.mgRlThrottleRateMax?.value) {
                    config.metricsGuardrails.infrastructure.rateLimiter.throttleRate = { max: parseFloat(stableFunctionFields.mgRlThrottleRateMax.value) };
                }
                if (stableFunctionFields.mgRlQueueLengthMax?.value) {
                    config.metricsGuardrails.infrastructure.rateLimiter.queueLength = { max: parseInt(stableFunctionFields.mgRlQueueLengthMax.value) };
                }
                if (stableFunctionFields.mgRlUtilizationMax?.value) {
                    config.metricsGuardrails.infrastructure.rateLimiter.utilizationPercentage = { max: parseInt(stableFunctionFields.mgRlUtilizationMax.value) };
                }
                if (stableFunctionFields.mgRlAvgQueueWaitTimeMax?.value) {
                    config.metricsGuardrails.infrastructure.rateLimiter.averageQueueWaitTime = { max: parseInt(stableFunctionFields.mgRlAvgQueueWaitTimeMax.value) };
                }
            }
            if (hasClMetrics) {
                config.metricsGuardrails.infrastructure.concurrencyLimiter = {};
                if (stableFunctionFields.mgClUtilizationMax?.value) {
                    config.metricsGuardrails.infrastructure.concurrencyLimiter.utilizationPercentage = { max: parseInt(stableFunctionFields.mgClUtilizationMax.value) };
                }
                if (stableFunctionFields.mgClQueueLengthMax?.value) {
                    config.metricsGuardrails.infrastructure.concurrencyLimiter.queueLength = { max: parseInt(stableFunctionFields.mgClQueueLengthMax.value) };
                }
                if (stableFunctionFields.mgClAvgQueueWaitTimeMax?.value) {
                    config.metricsGuardrails.infrastructure.concurrencyLimiter.averageQueueWaitTime = { max: parseInt(stableFunctionFields.mgClAvgQueueWaitTimeMax.value) };
                }
            }
        }
    }
    
    // Hook Params
    const hookParams = {};
    const raParams = parseJson(stableFunctionFields.hookParamsResponseAnalyzer?.value, stableFunctionFields.hookParamsResponseAnalyzer);
    const hsParams = parseJson(stableFunctionFields.hookParamsHandleSuccess?.value, stableFunctionFields.hookParamsHandleSuccess);
    const heParams = parseJson(stableFunctionFields.hookParamsHandleErrors?.value, stableFunctionFields.hookParamsHandleErrors);
    const feParams = parseJson(stableFunctionFields.hookParamsFinalErrorAnalyzer?.value, stableFunctionFields.hookParamsFinalErrorAnalyzer);
    
    if (raParams) hookParams.responseAnalyzerParams = raParams;
    if (hsParams) hookParams.handleSuccessfulAttemptDataParams = hsParams;
    if (heParams) hookParams.handleErrorsParams = heParams;
    if (feParams) hookParams.finalErrorAnalyzerParams = feParams;
    
    if (Object.keys(hookParams).length > 0) config.hookParams = hookParams;
    
    // TypeScript Generics
    const genericsInfo = {
        argsType: stableFunctionFields.genericArgsType?.value?.trim() || null,
        returnType: stableFunctionFields.genericReturnType?.value?.trim() || null
    };
    
    return { config, imports: [...new Set(imports)], needsEnums, genericsInfo, useSfStableBufferInCode, sfStableBufferOptions };
}

function generateSfCode() {
    const { config, imports, needsEnums, genericsInfo, useSfStableBufferInCode, sfStableBufferOptions } = generateStableFunctionConfig();
    
    const hasFn = config.fn;
    const hasArgs = config.args;
    
    // Build generic type string
    let genericTypeStr = '';
    if (genericsInfo.argsType || genericsInfo.returnType) {
        const argsType = genericsInfo.argsType || 'any[]';
        const returnType = genericsInfo.returnType || 'any';
        genericTypeStr = `<${argsType}, ${returnType}>`;
    }
    
    if (!hasFn || !hasArgs) {
        return `// ⚠️ Function and Arguments are required to generate a valid stableFunction configuration.
// Please provide both in the Function Configuration section.`;
    }
    
    let importLine = `import { ${imports.join(', ')} } from '@emmvish/stable-infra';`;
    
    // Generate StableBuffer code if enabled
    let stableBufferCode = '';
    if (useSfStableBufferInCode && sfStableBufferOptions) {
        const bufferOptionsStr = formatConfigValue(sfStableBufferOptions, 2, 2);
        stableBufferCode = `
  // Create StableBuffer instance
  const buffer = new StableBuffer(${bufferOptionsStr});
`;
        // Add buffer reference to config
        config.commonBuffer = 'buffer';
    }
    
    const configStr = formatConfigValue(config, 2, 2);
    
    return `${importLine}

(async () => {${stableBufferCode}
  const result = await stableFunction${genericTypeStr}(${configStr});

  // Handle the result
  if (result.success) {
    console.log('Success:', result.data);
    console.log('Metrics:', result.metrics);
  } else {
    console.error('Failed:', result.error);
    console.log('Error logs:', result.errorLogs);
  }
})();`;
}

function updateSfConfigOutput() {
    const outputCode = document.getElementById('sf-config-output-code');
    if (outputCode) {
        try {
            const code = generateSfCode();
            outputCode.textContent = code;
        } catch (e) {
            // Silently handle errors
        }
    }
}

function copySfGeneratedCode() {
    const code = document.getElementById('sf-config-output-code')?.textContent;
    if (code) {
        navigator.clipboard.writeText(code).then(() => {
            const btn = document.querySelector('#builder-stableFunction .output-actions .btn-icon');
            if (btn) {
                btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
                setTimeout(() => {
                    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
                }, 2000);
            }
        });
    }
}

function resetSfConfigBuilder() {
    Object.values(stableFunctionFields).forEach(field => {
        if (!field) return;
        if (field.type === 'checkbox') {
            field.checked = false;
        } else if (field.tagName === 'SELECT') {
            field.selectedIndex = 0;
        } else {
            field.value = '';
            field.classList.remove('valid', 'invalid');
        }
    });
    
    setSfDefaultValues();
    toggleSfCacheFields();
    toggleSfTrialModeFields();
    toggleSfPreExecutionFields();
    toggleSfObservabilityHook('errors');
    toggleSfObservabilityHook('success');
    toggleSfCommonBufferFields();
    toggleSfStableBufferFields();
    
    updateSfConfigOutput();
}

function setSfDefaultValues() {
    const defaults = {
        attempts: '1',
        wait: '1000',
        maxAllowedWait: '60000',
        jitter: '0',
        maxSerializableChars: '1000',
        cacheTtl: '300000',
        cacheMaxSize: '100',
        cbHalfOpenMaxRequests: '5',
        cbSuccessThresholdPercentage: '50',
        trialModeExecFailureProbability: '0',
        trialModeRetryFailureProbability: '0'
    };
    
    Object.entries(defaults).forEach(([fieldName, defaultValue]) => {
        const field = stableFunctionFields[fieldName];
        if (field && !field.value) {
            field.value = defaultValue;
        }
    });
    
    if (stableFunctionFields.retryStrategy && !stableFunctionFields.retryStrategy.value) {
        stableFunctionFields.retryStrategy.value = 'fixed';
    }
}

function initStableFunctionBuilder() {
    stableFunctionFields = {
        // TypeScript Generics
        genericArgsType: document.getElementById('sf-generic-args'),
        genericReturnType: document.getElementById('sf-generic-return'),
        
        // Function Configuration
        fn: document.getElementById('sf-fn'),
        args: document.getElementById('sf-args'),
        returnResult: document.getElementById('sf-returnResult'),
        
        // Retry
        attempts: document.getElementById('sf-attempts'),
        retryStrategy: document.getElementById('sf-retryStrategy'),
        wait: document.getElementById('sf-wait'),
        maxAllowedWait: document.getElementById('sf-maxAllowedWait'),
        jitter: document.getElementById('sf-jitter'),
        performAllAttempts: document.getElementById('sf-performAllAttempts'),
        throwOnFailedErrorAnalysis: document.getElementById('sf-throwOnFailedErrorAnalysis'),
        
        // Timeout & Concurrency
        executionTimeout: document.getElementById('sf-executionTimeout'),
        maxConcurrentRequests: document.getElementById('sf-maxConcurrentRequests'),
        
        // Analysis Hooks
        responseAnalyzer: document.getElementById('sf-responseAnalyzer'),
        finalErrorAnalyzer: document.getElementById('sf-finalErrorAnalyzer'),
        
        // Observability
        logAllErrors: document.getElementById('sf-logAllErrors'),
        logAllSuccessfulAttempts: document.getElementById('sf-logAllSuccessfulAttempts'),
        handleErrors: document.getElementById('sf-handleErrors'),
        handleSuccessfulAttemptData: document.getElementById('sf-handleSuccessfulAttemptData'),
        maxSerializableChars: document.getElementById('sf-maxSerializableChars'),
        
        // Cache
        cacheEnabled: document.getElementById('sf-cache-enabled'),
        cacheTtl: document.getElementById('sf-cache-ttl'),
        cacheMaxSize: document.getElementById('sf-cache-maxSize'),
        cacheKeyGenerator: document.getElementById('sf-cache-keyGenerator'),
        
        // Circuit Breaker
        cbFailureThresholdPercentage: document.getElementById('sf-cb-failureThresholdPercentage'),
        cbMinimumRequests: document.getElementById('sf-cb-minimumRequests'),
        cbRecoveryTimeoutMs: document.getElementById('sf-cb-recoveryTimeoutMs'),
        cbHalfOpenMaxRequests: document.getElementById('sf-cb-halfOpenMaxRequests'),
        cbSuccessThresholdPercentage: document.getElementById('sf-cb-successThresholdPercentage'),
        cbTrackIndividualAttempts: document.getElementById('sf-cb-trackIndividualAttempts'),
        
        // Rate Limiting
        rateLimitMaxRequests: document.getElementById('sf-rateLimit-maxRequests'),
        rateLimitWindowMs: document.getElementById('sf-rateLimit-windowMs'),
        
        // Common Buffer / StableBuffer
        bufferInitialState: document.getElementById('sf-buffer-initialState'),
        useStableBuffer: document.getElementById('sf-useStableBuffer'),
        bufferTransactionTimeoutMs: document.getElementById('sf-buffer-transactionTimeoutMs'),
        bufferCloneFn: document.getElementById('sf-buffer-clone'),
        bufferLogTransactionFn: document.getElementById('sf-buffer-logTransactionFn'),
        bufferMgTotalTransactionsMax: document.getElementById('sf-buffer-mg-totalTransactions-max'),
        bufferMgAvgQueueWaitMax: document.getElementById('sf-buffer-mg-avgQueueWait-max'),
        
        // Metrics Guardrails - Request/Function Execution
        mgTotalAttemptsMax: document.getElementById('sf-mg-totalAttempts-max'),
        mgSuccessfulAttemptsMin: document.getElementById('sf-mg-successfulAttempts-min'),
        mgFailedAttemptsMax: document.getElementById('sf-mg-failedAttempts-max'),
        mgTotalExecutionTimeMax: document.getElementById('sf-mg-totalExecutionTime-max'),
        mgAverageAttemptTimeMax: document.getElementById('sf-mg-averageAttemptTime-max'),
        // Metrics Guardrails - Circuit Breaker
        mgCbFailureRateMax: document.getElementById('sf-mg-cb-failureRate-max'),
        mgCbTotalRequestsMax: document.getElementById('sf-mg-cb-totalRequests-max'),
        mgCbFailedRequestsMax: document.getElementById('sf-mg-cb-failedRequests-max'),
        // Metrics Guardrails - Cache
        mgCacheHitRateMin: document.getElementById('sf-mg-cache-hitRate-min'),
        mgCacheMissRateMax: document.getElementById('sf-mg-cache-missRate-max'),
        mgCacheUtilizationMax: document.getElementById('sf-mg-cache-utilizationPercentage-max'),
        mgCacheEvictionRateMax: document.getElementById('sf-mg-cache-evictionRate-max'),
        // Metrics Guardrails - Rate Limiter
        mgRlThrottleRateMax: document.getElementById('sf-mg-rl-throttleRate-max'),
        mgRlQueueLengthMax: document.getElementById('sf-mg-rl-queueLength-max'),
        mgRlUtilizationMax: document.getElementById('sf-mg-rl-utilizationPercentage-max'),
        mgRlAvgQueueWaitTimeMax: document.getElementById('sf-mg-rl-averageQueueWaitTime-max'),
        // Metrics Guardrails - Concurrency Limiter
        mgClUtilizationMax: document.getElementById('sf-mg-cl-utilizationPercentage-max'),
        mgClQueueLengthMax: document.getElementById('sf-mg-cl-queueLength-max'),
        mgClAvgQueueWaitTimeMax: document.getElementById('sf-mg-cl-averageQueueWaitTime-max'),
        
        // Pre-Execution
        preExecutionHook: document.getElementById('sf-preExecution-hook'),
        preExecutionParams: document.getElementById('sf-preExecution-params'),
        preExecutionApplyOverride: document.getElementById('sf-preExecution-applyOverride'),
        preExecutionContinueOnFailure: document.getElementById('sf-preExecution-continueOnFailure'),
        
        // Trial Mode
        trialModeEnabled: document.getElementById('sf-trialMode-enabled'),
        trialModeExecFailureProbability: document.getElementById('sf-trialMode-execFailureProbability'),
        trialModeRetryFailureProbability: document.getElementById('sf-trialMode-retryFailureProbability'),
        loadTransactionLogs: document.getElementById('sf-loadTransactionLogs'),
        transactionLogs: document.getElementById('sf-transactionLogs'),
        
        // Execution Context
        ecWorkflowId: document.getElementById('sf-ec-workflowId'),
        ecPhaseId: document.getElementById('sf-ec-phaseId'),
        ecBranchId: document.getElementById('sf-ec-branchId'),
        ecRequestId: document.getElementById('sf-ec-requestId'),
        
        // Hook Params
        hookParamsResponseAnalyzer: document.getElementById('sf-hookParams-responseAnalyzer'),
        hookParamsHandleSuccess: document.getElementById('sf-hookParams-handleSuccessfulAttemptData'),
        hookParamsHandleErrors: document.getElementById('sf-hookParams-handleErrors'),
        hookParamsFinalErrorAnalyzer: document.getElementById('sf-hookParams-finalErrorAnalyzer')
    };
    
    setSfDefaultValues();
    
    Object.entries(stableFunctionFields).forEach(([name, field]) => {
        if (!field) return;
        field.addEventListener('input', updateSfConfigOutput);
        field.addEventListener('change', updateSfConfigOutput);
    });
    
    // Initialize toggle states
    toggleSfCommonBufferFields();
    toggleSfStableBufferFields();
    
    updateSfConfigOutput();
}

// ===== StableBuffer Config Builder =====

let stableBufferFields = {};

function generateStableBufferConfig() {
    const options = {};
    
    // Initial State
    const initialState = parseJson(stableBufferFields.initialState?.value, stableBufferFields.initialState);
    if (initialState) {
        options.initialState = initialState;
    }
    
    // Transaction Timeout
    const timeoutMs = parseInt(stableBufferFields.transactionTimeoutMs?.value);
    if (!isNaN(timeoutMs) && timeoutMs > 0) {
        options.transactionTimeoutMs = timeoutMs;
    }
    
    // Log Transaction
    const logTransaction = validateFunction(stableBufferFields.logTransaction?.value, stableBufferFields.logTransaction);
    if (logTransaction) {
        options.logTransaction = logTransaction;
    }
    
    // Clone function
    const cloneFn = validateFunction(stableBufferFields.clone?.value, stableBufferFields.clone);
    if (cloneFn) {
        options.clone = cloneFn;
    }
    
    // Metrics Guardrails
    const hasGuardrails = stableBufferFields.mgTotalTransactionsMax?.value ||
                          stableBufferFields.mgAvgQueueWaitMax?.value;
    
    if (hasGuardrails) {
        options.metricsGuardrails = {};
        
        if (stableBufferFields.mgTotalTransactionsMax?.value) {
            options.metricsGuardrails.totalTransactions = { max: parseInt(stableBufferFields.mgTotalTransactionsMax.value) };
        }
        if (stableBufferFields.mgAvgQueueWaitMax?.value) {
            options.metricsGuardrails.averageQueueWaitMs = { max: parseInt(stableBufferFields.mgAvgQueueWaitMax.value) };
        }
    }
    
    return options;
}

function generateSbCode() {
    const options = generateStableBufferConfig();
    
    let importLine = `import { StableBuffer } from '@emmvish/stable-infra';`;
    
    const hasOptions = Object.keys(options).length > 0;
    const optionsStr = hasOptions ? formatConfigValue(options, 2, 0) : '';
    
    const constructorArg = hasOptions ? optionsStr : '';
    
    let usageCode = '';
    if (options.initialState) {
        // Show usage with the initial state structure
        const stateKeys = Object.keys(options.initialState);
        if (stateKeys.length > 0) {
            const firstKey = stateKeys[0];
            const firstValue = options.initialState[firstKey];
            if (typeof firstValue === 'number') {
                usageCode = `

// Example: Increment ${firstKey}
await buffer.transaction((state) => {
  state.${firstKey} = (state.${firstKey} ?? 0) + 1;
});`;
            } else if (Array.isArray(firstValue)) {
                usageCode = `

// Example: Add item to ${firstKey}
await buffer.transaction((state) => {
  state.${firstKey}.push({ id: Date.now(), value: 'new item' });
});`;
            } else {
                usageCode = `

// Example: Update state
await buffer.transaction((state) => {
  state.${firstKey} = 'updated';
});`;
            }
        }
    } else {
        usageCode = `

// Example: Simple counter
await buffer.transaction((state) => {
  state.count = (state.count ?? 0) + 1;
});`;
    }
    
    return `${importLine}

const buffer = new StableBuffer(${constructorArg});${usageCode}

// Read current state (cloned snapshot)
console.log('State:', buffer.read());

// Get metrics
console.log('Metrics:', buffer.getMetrics());`;
}

function updateSbConfigOutput() {
    const outputCode = document.getElementById('sb-config-output-code');
    if (outputCode) {
        try {
            const code = generateSbCode();
            outputCode.textContent = code;
        } catch (e) {
            // Silently handle errors
        }
    }
}

function copySbGeneratedCode() {
    const code = document.getElementById('sb-config-output-code')?.textContent;
    if (code) {
        navigator.clipboard.writeText(code).then(() => {
            const btn = document.querySelector('#builder-StableBuffer .output-actions .btn-icon');
            if (btn) {
                btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
                setTimeout(() => {
                    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
                }, 2000);
            }
        });
    }
}

function resetSbConfigBuilder() {
    Object.values(stableBufferFields).forEach(field => {
        if (!field) return;
        if (field.type === 'checkbox') {
            field.checked = false;
        } else if (field.tagName === 'SELECT') {
            field.selectedIndex = 0;
        } else {
            field.value = '';
            field.classList.remove('valid', 'invalid');
        }
    });
    
    updateSbConfigOutput();
}

function initStableBufferBuilder() {
    stableBufferFields = {
        // Initial State
        initialState: document.getElementById('sb-initialState'),
        
        // Transaction Configuration
        transactionTimeoutMs: document.getElementById('sb-transactionTimeoutMs'),
        logTransaction: document.getElementById('sb-logTransaction'),
        
        // Clone Function
        clone: document.getElementById('sb-clone'),
        
        // Metrics Guardrails
        mgTotalTransactionsMax: document.getElementById('sb-mg-totalTransactions-max'),
        mgAvgQueueWaitMax: document.getElementById('sb-mg-avgQueueWait-max')
    };
    
    Object.entries(stableBufferFields).forEach(([name, field]) => {
        if (!field) return;
        field.addEventListener('input', updateSbConfigOutput);
        field.addEventListener('change', updateSbConfigOutput);
    });
    
    updateSbConfigOutput();
}

/*
// ============================================
// stableApiGateway Config Builder
// ============================================

let gwFields = {};
let gwRequestCounter = 0;
let gwFunctionCounter = 0;
let gwGroupCounter = 0;

// Toggle conditional fields
function toggleGwCacheFields() {
    const enabled = gwFields.commonCacheEnabled?.checked;
    const container = document.getElementById('gwCacheConfigFields');
    if (container) {
        container.classList.toggle('disabled', !enabled);
    }
    updateGwConfigOutput();
}

function toggleGwTrialModeFields() {
    const enabled = gwFields.commonTrialModeEnabled?.checked;
    const container = document.getElementById('gwTrialModeConfigFields');
    if (container) {
        container.classList.toggle('disabled', !enabled);
    }
    updateGwConfigOutput();
}

function toggleGwFunctionCacheFields() {
    const enabled = document.getElementById('gw-commonFunctionCache-enabled')?.checked;
    const container = document.getElementById('gwFunctionCacheConfigFields');
    if (container) {
        container.classList.toggle('disabled', !enabled);
    }
    updateGwConfigOutput();
}

// Request item with full configuration options
function addGwRequest() {
    gwRequestCounter++;
    const container = document.getElementById('gw-requests-container');
    const item = document.createElement('div');
    item.className = 'array-item';
    item.id = `gw-req-${gwRequestCounter}`;
    item.innerHTML = `
        <div class="array-item-header">
            <span class="array-item-title">Request #${gwRequestCounter}</span>
            <button type="button" class="btn-remove-item" onclick="removeGwRequest('gw-req-${gwRequestCounter}')" title="Remove request">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>
        <div class="array-item-fields">
            <!-- Core request settings -->
            <div class="field-row">
                <div class="field-group">
                    <label>Request ID <span class="required-critical">**</span></label>
                    <input type="text" class="builder-input gw-req-id" placeholder="e.g. getUser" onchange="updateGwConfigOutput()">
                </div>
                <div class="field-group">
                    <label>Group ID</label>
                    <input type="text" class="builder-input gw-req-groupId" placeholder="e.g. userRequests" onchange="updateGwConfigOutput()">
                    <span class="field-hint">Assign to a request group</span>
                </div>
            </div>
            <div class="field-row">
                <div class="field-group">
                    <label>Path <span class="required-critical">**</span></label>
                    <input type="text" class="builder-input gw-req-path" placeholder="e.g. /api/users/123" onchange="updateGwConfigOutput()">
                </div>
                <div class="field-group">
                    <label>Method</label>
                    <select class="builder-select gw-req-method" onchange="updateGwConfigOutput()">
                        <option value="GET" selected>GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="PATCH">PATCH</option>
                        <option value="DELETE">DELETE</option>
                    </select>
                </div>
            </div>
            <div class="field-row">
                <div class="field-group">
                    <label>Hostname (override)</label>
                    <input type="text" class="builder-input gw-req-hostname" placeholder="Override common hostname" onchange="updateGwConfigOutput()">
                </div>
                <div class="field-group">
                    <label>Timeout (ms)</label>
                    <input type="number" class="builder-input gw-req-timeout" placeholder="e.g. 30000" min="0" onchange="updateGwConfigOutput()">
                </div>
            </div>
            <div class="field-group">
                <label>Data/Body <span class="json-badge">JSON</span></label>
                <textarea class="builder-textarea gw-req-data" rows="2" placeholder='{"key": "value"}' onchange="updateGwConfigOutput()"></textarea>
            </div>
            <div class="field-group">
                <label>Headers (override) <span class="json-badge">JSON</span></label>
                <textarea class="builder-textarea gw-req-headers" rows="2" placeholder='{"X-Custom-Header": "value"}' onchange="updateGwConfigOutput()"></textarea>
            </div>
            
            <!-- Retry settings -->
            <div class="array-item-subsection">
                <span class="subsection-title">Retry Configuration (Override)</span>
                <div class="field-row">
                    <div class="field-group">
                        <label>Attempts</label>
                        <input type="number" class="builder-input gw-req-attempts" placeholder="Override" min="1" onchange="updateGwConfigOutput()">
                    </div>
                    <div class="field-group">
                        <label>Wait (ms)</label>
                        <input type="number" class="builder-input gw-req-wait" placeholder="Override" min="0" onchange="updateGwConfigOutput()">
                    </div>
                    <div class="field-group">
                        <label>Retry Strategy</label>
                        <select class="builder-select gw-req-retryStrategy" onchange="updateGwConfigOutput()">
                            <option value="" selected>Use common</option>
                            <option value="fixed">Fixed</option>
                            <option value="linear">Linear</option>
                            <option value="exponential">Exponential</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <!-- Analysis hooks -->
            <div class="array-item-subsection collapsible-subsection">
                <span class="subsection-title clickable" onclick="toggleSubsection(this)">
                    Analysis Hooks (Optional)
                    <svg class="chevron-small" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                </span>
                <div class="subsection-content collapsed">
                    <div class="field-group">
                        <label>Response Analyzer <span class="func-badge">Function</span></label>
                        <textarea class="builder-textarea code-textarea gw-req-responseAnalyzer" rows="2" placeholder="({ data, reqData }) => data.success !== false" onchange="updateGwConfigOutput()"></textarea>
                    </div>
                    <div class="field-group">
                        <label>Final Error Analyzer <span class="func-badge">Function</span></label>
                        <textarea class="builder-textarea code-textarea gw-req-finalErrorAnalyzer" rows="2" placeholder="({ error, reqData }) => false" onchange="updateGwConfigOutput()"></textarea>
                    </div>
                </div>
            </div>
            
            <!-- Pre-execution hook -->
            <div class="array-item-subsection collapsible-subsection">
                <span class="subsection-title clickable" onclick="toggleSubsection(this)">
                    Pre-Execution (Optional)
                    <svg class="chevron-small" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                </span>
                <div class="subsection-content collapsed">
                    <div class="field-group">
                        <label>Pre-Execution Hook <span class="func-badge">Function</span></label>
                        <textarea class="builder-textarea code-textarea gw-req-preExecution" rows="3" placeholder="({ inputParams, commonBuffer }) => { inputParams.data.token = commonBuffer.authToken; }" onchange="updateGwConfigOutput()"></textarea>
                    </div>
                </div>
            </div>
            
            <!-- Cache settings -->
            <div class="array-item-subsection collapsible-subsection">
                <span class="subsection-title clickable" onclick="toggleSubsection(this)">
                    Caching (Optional)
                    <svg class="chevron-small" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                </span>
                <div class="subsection-content collapsed">
                    <div class="field-row">
                        <div class="field-group">
                            <label>Cache TTL (ms)</label>
                            <input type="number" class="builder-input gw-req-cacheTtl" placeholder="e.g. 60000" min="0" onchange="updateGwConfigOutput()">
                        </div>
                        <div class="field-group">
                            <label>Cache Key Generator <span class="func-badge">Function</span></label>
                            <input type="text" class="builder-input code-input gw-req-cacheKeyGen" placeholder="(reqData) => reqData.path" onchange="updateGwConfigOutput()">
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    container.appendChild(item);
    updateGwConfigOutput();
}

function removeGwRequest(id) {
    const item = document.getElementById(id);
    if (item) {
        item.remove();
        updateGwConfigOutput();
    }
}

// Function item with full configuration options
function addGwFunction() {
    gwFunctionCounter++;
    const container = document.getElementById('gw-functions-container');
    const item = document.createElement('div');
    item.className = 'array-item';
    item.id = `gw-fn-${gwFunctionCounter}`;
    item.innerHTML = `
        <div class="array-item-header">
            <span class="array-item-title">Function #${gwFunctionCounter}</span>
            <button type="button" class="btn-remove-item" onclick="removeGwFunction('gw-fn-${gwFunctionCounter}')" title="Remove function">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>
        <div class="array-item-fields">
            <!-- Core function settings -->
            <div class="field-row">
                <div class="field-group">
                    <label>Function ID <span class="required-critical">**</span></label>
                    <input type="text" class="builder-input gw-fn-id" placeholder="e.g. processData" onchange="updateGwConfigOutput()">
                </div>
                <div class="field-group">
                    <label>Group ID</label>
                    <input type="text" class="builder-input gw-fn-groupId" placeholder="e.g. dataTasks" onchange="updateGwConfigOutput()">
                    <span class="field-hint">Assign to a request group</span>
                </div>
            </div>
            <div class="field-row">
                <div class="field-group">
                    <label>Function Reference <span class="required-critical">**</span></label>
                    <input type="text" class="builder-input gw-fn-ref code-input" placeholder="e.g. myFunction" onchange="updateGwConfigOutput()">
                    <span class="field-hint">Name of function variable</span>
                </div>
                <div class="field-group">
                    <label>Execution Timeout (ms)</label>
                    <input type="number" class="builder-input gw-fn-timeout" placeholder="e.g. 30000" min="0" onchange="updateGwConfigOutput()">
                </div>
            </div>
            <div class="field-group">
                <label>Function Args <span class="json-badge">JSON Array</span></label>
                <textarea class="builder-textarea gw-fn-args" rows="2" placeholder='["arg1", 42, true]' onchange="updateGwConfigOutput()"></textarea>
                <span class="field-hint">Arguments to pass to the function</span>
            </div>
            <div class="field-row">
                <div class="field-group checkbox-group">
                    <label class="checkbox-label">
                        <input type="checkbox" class="gw-fn-returnResult" onchange="updateGwConfigOutput()">
                        <span class="checkbox-custom"></span>
                        Return Result
                    </label>
                    <span class="field-hint">Include return value in response</span>
                </div>
            </div>
            
            <!-- Retry settings -->
            <div class="array-item-subsection">
                <span class="subsection-title">Retry Configuration (Override)</span>
                <div class="field-row">
                    <div class="field-group">
                        <label>Attempts</label>
                        <input type="number" class="builder-input gw-fn-attempts" placeholder="Override" min="1" onchange="updateGwConfigOutput()">
                    </div>
                    <div class="field-group">
                        <label>Wait (ms)</label>
                        <input type="number" class="builder-input gw-fn-wait" placeholder="Override" min="0" onchange="updateGwConfigOutput()">
                    </div>
                    <div class="field-group">
                        <label>Retry Strategy</label>
                        <select class="builder-select gw-fn-retryStrategy" onchange="updateGwConfigOutput()">
                            <option value="" selected>Use common</option>
                            <option value="fixed">Fixed</option>
                            <option value="linear">Linear</option>
                            <option value="exponential">Exponential</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <!-- Analysis hooks -->
            <div class="array-item-subsection collapsible-subsection">
                <span class="subsection-title clickable" onclick="toggleSubsection(this)">
                    Analysis Hooks (Optional)
                    <svg class="chevron-small" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                </span>
                <div class="subsection-content collapsed">
                    <div class="field-group">
                        <label>Response Analyzer <span class="func-badge">Function</span></label>
                        <textarea class="builder-textarea code-textarea gw-fn-responseAnalyzer" rows="2" placeholder="({ data, fn, args }) => data !== null" onchange="updateGwConfigOutput()"></textarea>
                    </div>
                    <div class="field-group">
                        <label>Final Error Analyzer <span class="func-badge">Function</span></label>
                        <textarea class="builder-textarea code-textarea gw-fn-finalErrorAnalyzer" rows="2" placeholder="({ error, fn, args }) => false" onchange="updateGwConfigOutput()"></textarea>
                    </div>
                </div>
            </div>
            
            <!-- Pre-execution hook -->
            <div class="array-item-subsection collapsible-subsection">
                <span class="subsection-title clickable" onclick="toggleSubsection(this)">
                    Pre-Execution (Optional)
                    <svg class="chevron-small" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                </span>
                <div class="subsection-content collapsed">
                    <div class="field-group">
                        <label>Pre-Execution Hook <span class="func-badge">Function</span></label>
                        <textarea class="builder-textarea code-textarea gw-fn-preExecution" rows="3" placeholder="({ inputParams, commonBuffer }) => { inputParams.args[0] = commonBuffer.userId; }" onchange="updateGwConfigOutput()"></textarea>
                    </div>
                </div>
            </div>
            
            <!-- Cache settings -->
            <div class="array-item-subsection collapsible-subsection">
                <span class="subsection-title clickable" onclick="toggleSubsection(this)">
                    Caching (Optional)
                    <svg class="chevron-small" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                </span>
                <div class="subsection-content collapsed">
                    <div class="field-row">
                        <div class="field-group">
                            <label>Cache TTL (ms)</label>
                            <input type="number" class="builder-input gw-fn-cacheTtl" placeholder="e.g. 60000" min="0" onchange="updateGwConfigOutput()">
                        </div>
                        <div class="field-group">
                            <label>Cache Key Generator <span class="func-badge">Function</span></label>
                            <input type="text" class="builder-input code-input gw-fn-cacheKeyGen" placeholder="(args) => args.join(':')" onchange="updateGwConfigOutput()">
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    container.appendChild(item);
    updateGwConfigOutput();
}

function removeGwFunction(id) {
    const item = document.getElementById(id);
    if (item) {
        item.remove();
        updateGwConfigOutput();
    }
}

// Request Group management
function addGwGroup() {
    gwGroupCounter++;
    const container = document.getElementById('gw-groups-container');
    const item = document.createElement('div');
    item.className = 'array-item';
    item.id = `gw-group-${gwGroupCounter}`;
    item.innerHTML = `
        <div class="array-item-header">
            <span class="array-item-title">Group #${gwGroupCounter}</span>
            <button type="button" class="btn-remove-item" onclick="removeGwGroup('gw-group-${gwGroupCounter}')" title="Remove group">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>
        <div class="array-item-fields">
            <div class="field-row">
                <div class="field-group">
                    <label>Group ID <span class="required-critical">**</span></label>
                    <input type="text" class="builder-input gw-group-id" placeholder="e.g. userRequests" onchange="updateGwConfigOutput()">
                    <span class="field-hint">Match this ID in request/function groupId field</span>
                </div>
            </div>
            
            <!-- Group-level overrides -->
            <div class="array-item-subsection">
                <span class="subsection-title">Group Configuration (Overrides Global)</span>
                <div class="field-row">
                    <div class="field-group">
                        <label>Hostname</label>
                        <input type="text" class="builder-input gw-group-hostname" placeholder="e.g. api.users.example.com" onchange="updateGwConfigOutput()">
                    </div>
                    <div class="field-group">
                        <label>Timeout (ms)</label>
                        <input type="number" class="builder-input gw-group-timeout" placeholder="e.g. 30000" min="0" onchange="updateGwConfigOutput()">
                    </div>
                </div>
                <div class="field-row">
                    <div class="field-group">
                        <label>Attempts</label>
                        <input type="number" class="builder-input gw-group-attempts" placeholder="Override" min="1" onchange="updateGwConfigOutput()">
                    </div>
                    <div class="field-group">
                        <label>Wait (ms)</label>
                        <input type="number" class="builder-input gw-group-wait" placeholder="Override" min="0" onchange="updateGwConfigOutput()">
                    </div>
                    <div class="field-group">
                        <label>Retry Strategy</label>
                        <select class="builder-select gw-group-retryStrategy" onchange="updateGwConfigOutput()">
                            <option value="" selected>Use common</option>
                            <option value="fixed">Fixed</option>
                            <option value="linear">Linear</option>
                            <option value="exponential">Exponential</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <div class="field-group">
                <label>Headers (override) <span class="json-badge">JSON</span></label>
                <textarea class="builder-textarea gw-group-headers" rows="2" placeholder='{"X-Group-Header": "value"}' onchange="updateGwConfigOutput()"></textarea>
            </div>
        </div>
    `;
    container.appendChild(item);
    updateGwConfigOutput();
}

function removeGwGroup(id) {
    const item = document.getElementById(id);
    if (item) {
        item.remove();
        updateGwConfigOutput();
    }
}

// Toggle collapsible subsections in array items
function toggleSubsection(element) {
    const content = element.nextElementSibling;
    if (content) {
        content.classList.toggle('collapsed');
        element.classList.toggle('expanded');
    }
}

// Get all requests from the form
function getGwRequests() {
    const container = document.getElementById('gw-requests-container');
    const items = container.querySelectorAll('.array-item');
    const requests = [];
    
    items.forEach(item => {
        const id = item.querySelector('.gw-req-id')?.value?.trim();
        const path = item.querySelector('.gw-req-path')?.value?.trim();
        
        if (id && path) {
            const req = { id };
            const requestOptions = { path };
            
            const groupId = item.querySelector('.gw-req-groupId')?.value?.trim();
            if (groupId) req.groupId = groupId;
            
            const method = item.querySelector('.gw-req-method')?.value;
            if (method && method !== 'GET') requestOptions.method = method;
            
            const hostname = item.querySelector('.gw-req-hostname')?.value?.trim();
            if (hostname) requestOptions.hostname = hostname;
            
            const timeout = item.querySelector('.gw-req-timeout')?.value;
            if (timeout) requestOptions.timeout = parseInt(timeout);
            
            const data = item.querySelector('.gw-req-data')?.value?.trim();
            if (data) {
                try {
                    requestOptions.data = JSON.parse(data);
                } catch (e) {}
            }
            
            const headers = item.querySelector('.gw-req-headers')?.value?.trim();
            if (headers) {
                try {
                    requestOptions.headers = JSON.parse(headers);
                } catch (e) {}
            }
            
            // Retry settings
            const attempts = item.querySelector('.gw-req-attempts')?.value;
            if (attempts) requestOptions.attempts = parseInt(attempts);
            
            const wait = item.querySelector('.gw-req-wait')?.value;
            if (wait) requestOptions.wait = parseInt(wait);
            
            const retryStrategy = item.querySelector('.gw-req-retryStrategy')?.value;
            if (retryStrategy) requestOptions.retryStrategy = retryStrategy;
            
            // Analysis hooks
            const responseAnalyzer = item.querySelector('.gw-req-responseAnalyzer')?.value?.trim();
            if (responseAnalyzer) requestOptions.responseAnalyzer = responseAnalyzer;
            
            const finalErrorAnalyzer = item.querySelector('.gw-req-finalErrorAnalyzer')?.value?.trim();
            if (finalErrorAnalyzer) requestOptions.finalErrorAnalyzer = finalErrorAnalyzer;
            
            // Pre-execution
            const preExecution = item.querySelector('.gw-req-preExecution')?.value?.trim();
            if (preExecution) requestOptions.preExecution = { hook: preExecution };
            
            // Cache
            const cacheTtl = item.querySelector('.gw-req-cacheTtl')?.value;
            const cacheKeyGen = item.querySelector('.gw-req-cacheKeyGen')?.value?.trim();
            if (cacheTtl || cacheKeyGen) {
                requestOptions.cache = {};
                if (cacheTtl) requestOptions.cache.ttlMs = parseInt(cacheTtl);
                if (cacheKeyGen) requestOptions.cache.keyGenerator = cacheKeyGen;
            }
            
            req.requestOptions = requestOptions;
            requests.push(req);
        }
    });
    
    return requests;
}

// Get all functions from the form
function getGwFunctions() {
    const container = document.getElementById('gw-functions-container');
    const items = container.querySelectorAll('.array-item');
    const functions = [];
    
    items.forEach(item => {
        const id = item.querySelector('.gw-fn-id')?.value?.trim();
        const fnRef = item.querySelector('.gw-fn-ref')?.value?.trim();
        
        if (id && fnRef) {
            const fn = { id };
            const functionOptions = { fn: fnRef };
            
            const groupId = item.querySelector('.gw-fn-groupId')?.value?.trim();
            if (groupId) fn.groupId = groupId;
            
            const timeout = item.querySelector('.gw-fn-timeout')?.value;
            if (timeout) functionOptions.executionTimeout = parseInt(timeout);
            
            const args = item.querySelector('.gw-fn-args')?.value?.trim();
            if (args) {
                try {
                    functionOptions.args = JSON.parse(args);
                } catch (e) {}
            }
            
            const returnResult = item.querySelector('.gw-fn-returnResult')?.checked;
            if (returnResult) functionOptions.returnResult = true;
            
            // Retry settings
            const attempts = item.querySelector('.gw-fn-attempts')?.value;
            if (attempts) functionOptions.attempts = parseInt(attempts);
            
            const wait = item.querySelector('.gw-fn-wait')?.value;
            if (wait) functionOptions.wait = parseInt(wait);
            
            const retryStrategy = item.querySelector('.gw-fn-retryStrategy')?.value;
            if (retryStrategy) functionOptions.retryStrategy = retryStrategy;
            
            // Analysis hooks
            const responseAnalyzer = item.querySelector('.gw-fn-responseAnalyzer')?.value?.trim();
            if (responseAnalyzer) functionOptions.responseAnalyzer = responseAnalyzer;
            
            const finalErrorAnalyzer = item.querySelector('.gw-fn-finalErrorAnalyzer')?.value?.trim();
            if (finalErrorAnalyzer) functionOptions.finalErrorAnalyzer = finalErrorAnalyzer;
            
            // Pre-execution
            const preExecution = item.querySelector('.gw-fn-preExecution')?.value?.trim();
            if (preExecution) functionOptions.preExecution = { hook: preExecution };
            
            // Cache
            const cacheTtl = item.querySelector('.gw-fn-cacheTtl')?.value;
            const cacheKeyGen = item.querySelector('.gw-fn-cacheKeyGen')?.value?.trim();
            if (cacheTtl || cacheKeyGen) {
                functionOptions.cache = {};
                if (cacheTtl) functionOptions.cache.ttlMs = parseInt(cacheTtl);
                if (cacheKeyGen) functionOptions.cache.keyGenerator = cacheKeyGen;
            }
            
            fn.functionOptions = functionOptions;
            functions.push(fn);
        }
    });
    
    return functions;
}

// Get all request groups from the form
function getGwGroups() {
    const container = document.getElementById('gw-groups-container');
    const items = container.querySelectorAll('.array-item');
    const groups = [];
    
    items.forEach(item => {
        const id = item.querySelector('.gw-group-id')?.value?.trim();
        
        if (id) {
            const group = { id };
            
            const hostname = item.querySelector('.gw-group-hostname')?.value?.trim();
            if (hostname) group.hostname = hostname;
            
            const timeout = item.querySelector('.gw-group-timeout')?.value;
            if (timeout) group.timeout = parseInt(timeout);
            
            const attempts = item.querySelector('.gw-group-attempts')?.value;
            if (attempts) group.attempts = parseInt(attempts);
            
            const wait = item.querySelector('.gw-group-wait')?.value;
            if (wait) group.wait = parseInt(wait);
            
            const retryStrategy = item.querySelector('.gw-group-retryStrategy')?.value;
            if (retryStrategy) group.retryStrategy = retryStrategy;
            
            const headers = item.querySelector('.gw-group-headers')?.value?.trim();
            if (headers) {
                try {
                    group.headers = JSON.parse(headers);
                } catch (e) {}
            }
            
            groups.push(group);
        }
    });
    
    return groups;
}

// Generate the complete gateway configuration
function generateGwConfig() {
    const imports = ['stableApiGateway'];
    let needsEnums = false;
    const config = {};
    const functionDefs = [];
    
    // Generics
    const genericRequest = gwFields.genericRequest?.value?.trim();
    const genericResponse = gwFields.genericResponse?.value?.trim();
    const genericFnArgs = gwFields.genericFnArgs?.value?.trim();
    const genericFnReturn = gwFields.genericFnReturn?.value?.trim();
    
    const genericsInfo = {
        request: genericRequest,
        response: genericResponse,
        fnArgs: genericFnArgs,
        fnReturn: genericFnReturn
    };
    
    // Execution mode
    const concurrentExecution = gwFields.concurrentExecution?.checked;
    if (!concurrentExecution) config.concurrentExecution = false;
    
    const stopOnFirstError = gwFields.stopOnFirstError?.checked;
    if (stopOnFirstError) config.stopOnFirstError = true;
    
    const enableRacing = gwFields.enableRacing?.checked;
    if (enableRacing) config.enableRacing = true;
    
    const maxTimeout = gwFields.maxTimeout?.value;
    if (maxTimeout) config.maxTimeout = parseInt(maxTimeout);
    
    // Common request data
    const commonRequestData = {};
    const hostname = gwFields.commonRequestDataHostname?.value?.trim();
    if (hostname) commonRequestData.hostname = hostname;
    
    const protocol = gwFields.commonRequestDataProtocol?.value;
    if (protocol && protocol !== 'https') commonRequestData.protocol = protocol;
    
    const port = gwFields.commonRequestDataPort?.value;
    if (port) commonRequestData.port = parseInt(port);
    
    const commonTimeout = gwFields.commonRequestDataTimeout?.value;
    if (commonTimeout) commonRequestData.timeout = parseInt(commonTimeout);
    
    const headers = gwFields.commonRequestDataHeaders?.value?.trim();
    if (headers) {
        try {
            commonRequestData.headers = JSON.parse(headers);
        } catch (e) {}
    }
    
    const query = gwFields.commonRequestDataQuery?.value?.trim();
    if (query) {
        try {
            commonRequestData.query = JSON.parse(query);
        } catch (e) {}
    }
    
    const body = gwFields.commonRequestDataBody?.value?.trim();
    if (body) {
        try {
            commonRequestData.body = JSON.parse(body);
        } catch (e) {}
    }
    
    const method = gwFields.commonRequestDataMethod?.value;
    if (method && method !== 'GET') commonRequestData.method = method;
    
    if (Object.keys(commonRequestData).length > 0) {
        config.commonRequestData = commonRequestData;
    }
    
    const commonResReq = gwFields.commonResReq?.checked;
    if (commonResReq) config.commonResReq = true;
    
    // Common retry config
    const commonAttempts = gwFields.commonAttempts?.value;
    if (commonAttempts && parseInt(commonAttempts) !== 1) {
        config.commonAttempts = parseInt(commonAttempts);
    }
    
    const commonRetryStrategy = gwFields.commonRetryStrategy?.value;
    if (commonRetryStrategy && commonRetryStrategy !== 'fixed') {
        config.commonRetryStrategy = `RETRY_STRATEGY.${commonRetryStrategy.toUpperCase()}`;
        needsEnums = true;
    }
    
    const commonWait = gwFields.commonWait?.value;
    if (commonWait && parseInt(commonWait) !== 1000) {
        config.commonWait = parseInt(commonWait);
    }
    
    const commonMaxAllowedWait = gwFields.commonMaxAllowedWait?.value;
    if (commonMaxAllowedWait && parseInt(commonMaxAllowedWait) !== 60000) {
        config.commonMaxAllowedWait = parseInt(commonMaxAllowedWait);
    }
    
    const commonJitter = gwFields.commonJitter?.value;
    if (commonJitter && parseInt(commonJitter) > 0) {
        config.commonJitter = parseInt(commonJitter);
    }
    
    const commonPerformAllAttempts = gwFields.commonPerformAllAttempts?.checked;
    if (commonPerformAllAttempts) config.commonPerformAllAttempts = true;
    
    // Common function config
    const commonExecutionTimeout = gwFields.commonExecutionTimeout?.value;
    if (commonExecutionTimeout) config.commonExecutionTimeout = parseInt(commonExecutionTimeout);
    
    const commonReturnResult = gwFields.commonReturnResult?.checked;
    if (commonReturnResult) config.commonReturnResult = true;
    
    // Common analysis hooks
    const commonResponseAnalyzer = gwFields.commonResponseAnalyzer?.value?.trim();
    if (commonResponseAnalyzer) {
        config.commonResponseAnalyzer = commonResponseAnalyzer;
        functionDefs.push({ name: 'commonResponseAnalyzer', value: commonResponseAnalyzer });
    }
    
    const commonFinalErrorAnalyzer = gwFields.commonFinalErrorAnalyzer?.value?.trim();
    if (commonFinalErrorAnalyzer) {
        config.commonFinalErrorAnalyzer = commonFinalErrorAnalyzer;
        functionDefs.push({ name: 'commonFinalErrorAnalyzer', value: commonFinalErrorAnalyzer });
    }
    
    const commonFunctionResponseAnalyzer = gwFields.commonFunctionResponseAnalyzer?.value?.trim();
    if (commonFunctionResponseAnalyzer) {
        config.commonFunctionResponseAnalyzer = commonFunctionResponseAnalyzer;
        functionDefs.push({ name: 'commonFunctionResponseAnalyzer', value: commonFunctionResponseAnalyzer });
    }
    
    const commonFinalFunctionErrorAnalyzer = gwFields.commonFinalFunctionErrorAnalyzer?.value?.trim();
    if (commonFinalFunctionErrorAnalyzer) {
        config.commonFinalFunctionErrorAnalyzer = commonFinalFunctionErrorAnalyzer;
        functionDefs.push({ name: 'commonFinalFunctionErrorAnalyzer', value: commonFinalFunctionErrorAnalyzer });
    }
    
    // Common pre-execution hooks
    const commonPreExecutionHook = gwFields.commonPreExecutionHook?.value?.trim();
    const commonPreExecutionInputParams = gwFields.commonPreExecutionInputParams?.value?.trim();
    if (commonPreExecutionHook) {
        config.commonPreExecution = { preExecutionHook: commonPreExecutionHook };
        functionDefs.push({ name: 'commonPreExecutionHook', value: commonPreExecutionHook });
        if (commonPreExecutionInputParams) {
            try {
                config.commonPreExecution.preExecutionHookParams = JSON.parse(commonPreExecutionInputParams);
            } catch (e) {}
        }
    }
    
    const commonFunctionPreExecutionHook = gwFields.commonFunctionPreExecutionHook?.value?.trim();
    const commonFunctionPreExecutionInputParams = gwFields.commonFunctionPreExecutionInputParams?.value?.trim();
    if (commonFunctionPreExecutionHook) {
        config.commonFunctionPreExecution = { preExecutionHook: commonFunctionPreExecutionHook };
        functionDefs.push({ name: 'commonFunctionPreExecutionHook', value: commonFunctionPreExecutionHook });
        if (commonFunctionPreExecutionInputParams) {
            try {
                config.commonFunctionPreExecution.preExecutionHookParams = JSON.parse(commonFunctionPreExecutionInputParams);
            } catch (e) {}
        }
    }
    
    // Common observability
    const logAllErrors = gwFields.commonLogAllErrors?.checked;
    if (logAllErrors) config.commonLogAllErrors = true;
    
    const logAllSuccessful = gwFields.commonLogAllSuccessfulAttempts?.checked;
    if (logAllSuccessful) config.commonLogAllSuccessfulAttempts = true;
    
    const commonHandleErrors = gwFields.commonHandleErrors?.value?.trim();
    if (commonHandleErrors) {
        config.commonHandleErrors = commonHandleErrors;
        functionDefs.push({ name: 'commonHandleErrors', value: commonHandleErrors });
    }
    
    const commonHandleSuccessfulAttemptData = gwFields.commonHandleSuccessfulAttemptData?.value?.trim();
    if (commonHandleSuccessfulAttemptData) {
        config.commonHandleSuccessfulAttemptData = commonHandleSuccessfulAttemptData;
        functionDefs.push({ name: 'commonHandleSuccessfulAttemptData', value: commonHandleSuccessfulAttemptData });
    }
    
    const commonHandleFunctionErrors = gwFields.commonHandleFunctionErrors?.value?.trim();
    if (commonHandleFunctionErrors) {
        config.commonHandleFunctionErrors = commonHandleFunctionErrors;
        functionDefs.push({ name: 'commonHandleFunctionErrors', value: commonHandleFunctionErrors });
    }
    
    const commonHandleSuccessfulFunctionAttemptData = gwFields.commonHandleSuccessfulFunctionAttemptData?.value?.trim();
    if (commonHandleSuccessfulFunctionAttemptData) {
        config.commonHandleSuccessfulFunctionAttemptData = commonHandleSuccessfulFunctionAttemptData;
        functionDefs.push({ name: 'commonHandleSuccessfulFunctionAttemptData', value: commonHandleSuccessfulFunctionAttemptData });
    }
    
    const maxSerializableChars = gwFields.commonMaxSerializableChars?.value;
    if (maxSerializableChars && parseInt(maxSerializableChars) !== 1000) {
        config.commonMaxSerializableChars = parseInt(maxSerializableChars);
    }
    
    // Common hook params
    const commonHookParams = {};
    const hpResponseAnalyzer = gwFields.commonHookParamsResponseAnalyzer?.value?.trim();
    if (hpResponseAnalyzer) { try { commonHookParams.responseAnalyzerParams = JSON.parse(hpResponseAnalyzer); } catch (e) {} }
    const hpHandleSuccessful = gwFields.commonHookParamsHandleSuccessful?.value?.trim();
    if (hpHandleSuccessful) { try { commonHookParams.handleSuccessfulAttemptDataParams = JSON.parse(hpHandleSuccessful); } catch (e) {} }
    const hpHandleErrors = gwFields.commonHookParamsHandleErrors?.value?.trim();
    if (hpHandleErrors) { try { commonHookParams.handleErrorsParams = JSON.parse(hpHandleErrors); } catch (e) {} }
    const hpFinalError = gwFields.commonHookParamsFinalError?.value?.trim();
    if (hpFinalError) { try { commonHookParams.finalErrorAnalyzerParams = JSON.parse(hpFinalError); } catch (e) {} }
    if (Object.keys(commonHookParams).length > 0) config.commonHookParams = commonHookParams;
    
    // Common function hook params
    const commonFunctionHookParams = {};
    const fhpResponseAnalyzer = gwFields.commonFunctionHookParamsResponseAnalyzer?.value?.trim();
    if (fhpResponseAnalyzer) { try { commonFunctionHookParams.responseAnalyzerParams = JSON.parse(fhpResponseAnalyzer); } catch (e) {} }
    const fhpHandleSuccessful = gwFields.commonFunctionHookParamsHandleSuccessful?.value?.trim();
    if (fhpHandleSuccessful) { try { commonFunctionHookParams.handleSuccessfulAttemptDataParams = JSON.parse(fhpHandleSuccessful); } catch (e) {} }
    const fhpHandleErrors = gwFields.commonFunctionHookParamsHandleErrors?.value?.trim();
    if (fhpHandleErrors) { try { commonFunctionHookParams.handleErrorsParams = JSON.parse(fhpHandleErrors); } catch (e) {} }
    const fhpFinalError = gwFields.commonFunctionHookParamsFinalError?.value?.trim();
    if (fhpFinalError) { try { commonFunctionHookParams.finalErrorAnalyzerParams = JSON.parse(fhpFinalError); } catch (e) {} }
    if (Object.keys(commonFunctionHookParams).length > 0) config.commonFunctionHookParams = commonFunctionHookParams;
    
    // Common request caching
    const cacheEnabled = gwFields.commonCacheEnabled?.checked;
    if (cacheEnabled) {
        const cacheTtl = gwFields.commonCacheTtl?.value;
        const cacheMaxSize = gwFields.commonCacheMaxSize?.value;
        const cacheKeyGenerator = gwFields.commonCacheKeyGenerator?.value?.trim();
        const staleWhileRevalidate = gwFields.commonCacheStaleWhileRevalidate?.checked;
        const staleIfError = gwFields.commonCacheStaleIfError?.checked;
        
        if (cacheTtl) {
            config.commonCache = { ttlMs: parseInt(cacheTtl) };
            if (cacheMaxSize) config.commonCache.maxSize = parseInt(cacheMaxSize);
            if (cacheKeyGenerator) {
                config.commonCache.keyGenerator = cacheKeyGenerator;
                functionDefs.push({ name: 'cacheKeyGenerator', value: cacheKeyGenerator });
            }
            if (staleWhileRevalidate) config.commonCache.staleWhileRevalidate = true;
            if (staleIfError) config.commonCache.staleIfError = true;
        }
    }
    
    // Common function caching
    const functionCacheEnabled = gwFields.commonFunctionCacheEnabled?.checked;
    if (functionCacheEnabled) {
        const fnCacheTtl = gwFields.commonFunctionCacheTtl?.value;
        const fnCacheMaxSize = gwFields.commonFunctionCacheMaxSize?.value;
        const fnCacheKeyGenerator = gwFields.commonFunctionCacheKeyGenerator?.value?.trim();
        
        if (fnCacheTtl) {
            config.commonFunctionCache = { ttlMs: parseInt(fnCacheTtl) };
            if (fnCacheMaxSize) config.commonFunctionCache.maxSize = parseInt(fnCacheMaxSize);
            if (fnCacheKeyGenerator) {
                config.commonFunctionCache.keyGenerator = fnCacheKeyGenerator;
                functionDefs.push({ name: 'functionCacheKeyGenerator', value: fnCacheKeyGenerator });
            }
        }
    }
    
    // Common state persistence
    const statePersistenceOnStateChange = gwFields.commonStatePersistenceOnStateChange?.value?.trim();
    const statePersistenceOnCompletion = gwFields.commonStatePersistenceOnCompletion?.value?.trim();
    if (statePersistenceOnStateChange || statePersistenceOnCompletion) {
        config.commonStatePersistence = {};
        if (statePersistenceOnStateChange) {
            config.commonStatePersistence.persistenceFunction = statePersistenceOnStateChange;
            functionDefs.push({ name: 'persistenceFunction', value: statePersistenceOnStateChange });
        }
    }
    
    // Common trial mode
    const trialModeEnabled = gwFields.commonTrialModeEnabled?.checked;
    if (trialModeEnabled) {
        const mockData = gwFields.commonTrialModeMockData?.value?.trim();
        const mockLatency = gwFields.commonTrialModeMockLatencyMs?.value;
        
        config.commonTrialMode = { enabled: true };
        if (mockData) {
            try {
                config.commonTrialMode.mockData = JSON.parse(mockData);
            } catch (e) {}
        }
        if (mockLatency) config.commonTrialMode.mockLatencyMs = parseInt(mockLatency);
    }
    
    // Rate limiting & Concurrency
    const maxConcurrentRequests = gwFields.maxConcurrentRequests?.value;
    if (maxConcurrentRequests) {
        config.maxConcurrentRequests = parseInt(maxConcurrentRequests);
    }
    
    const rlMaxRequests = gwFields.rateLimitMaxRequests?.value;
    const rlWindowMs = gwFields.rateLimitWindowMs?.value;
    if (rlMaxRequests && rlWindowMs) {
        config.rateLimit = {
            maxRequests: parseInt(rlMaxRequests),
            windowMs: parseInt(rlWindowMs)
        };
    }
    
    // Circuit breaker
    const cbFailure = gwFields.cbFailureThresholdPercentage?.value;
    const cbMinRequests = gwFields.cbMinimumRequests?.value;
    const cbRecovery = gwFields.cbRecoveryTimeoutMs?.value;
    
    if (cbFailure && cbMinRequests && cbRecovery) {
        config.circuitBreaker = {
            failureThresholdPercentage: parseInt(cbFailure),
            minimumRequests: parseInt(cbMinRequests),
            recoveryTimeoutMs: parseInt(cbRecovery)
        };
        
        const cbHalfOpen = gwFields.cbHalfOpenMaxRequests?.value;
        if (cbHalfOpen && parseInt(cbHalfOpen) !== 5) {
            config.circuitBreaker.halfOpenMaxRequests = parseInt(cbHalfOpen);
        }
        
        const cbSuccess = gwFields.cbSuccessThresholdPercentage?.value;
        if (cbSuccess && parseInt(cbSuccess) !== 50) {
            config.circuitBreaker.successThresholdPercentage = parseInt(cbSuccess);
        }
        
        const cbTrackSlow = gwFields.cbTrackSlowCalls?.checked;
        if (cbTrackSlow) {
            config.circuitBreaker.trackSlowCalls = true;
            const cbSlowDuration = gwFields.cbSlowCallDurationMs?.value;
            if (cbSlowDuration) config.circuitBreaker.slowCallDurationMs = parseInt(cbSlowDuration);
            const cbSlowThreshold = gwFields.cbSlowCallThresholdPercentage?.value;
            if (cbSlowThreshold) config.circuitBreaker.slowCallThresholdPercentage = parseInt(cbSlowThreshold);
        }
    }
    
    // Shared buffer
    const sharedBuffer = gwFields.sharedBuffer?.value?.trim();
    if (sharedBuffer) {
        try {
            config.sharedBuffer = JSON.parse(sharedBuffer);
        } catch (e) {}
    }
    
    // Execution context
    const executionContext = {};
    const ecWorkflowId = gwFields.ecWorkflowId?.value?.trim();
    if (ecWorkflowId) executionContext.workflowId = ecWorkflowId;
    
    const ecPhaseId = gwFields.ecPhaseId?.value?.trim();
    if (ecPhaseId) executionContext.phaseId = ecPhaseId;
    
    const ecBranchId = gwFields.ecBranchId?.value?.trim();
    if (ecBranchId) executionContext.branchId = ecBranchId;
    
    const ecRequestId = gwFields.ecRequestId?.value?.trim();
    if (ecRequestId) executionContext.requestId = ecRequestId;
    
    if (Object.keys(executionContext).length > 0) {
        config.executionContext = executionContext;
    }
    
    // Metrics guardrails
    const metricsGuardrails = {};
    const mgSuccessRateMin = gwFields.mgSuccessRateMin?.value;
    if (mgSuccessRateMin) metricsGuardrails.successRate = { min: parseFloat(mgSuccessRateMin) };
    
    const mgExecutionTimeMax = gwFields.mgExecutionTimeMax?.value;
    if (mgExecutionTimeMax) metricsGuardrails.executionTime = { max: parseInt(mgExecutionTimeMax) };
    
    const mgThroughputMin = gwFields.mgThroughputMin?.value;
    if (mgThroughputMin) metricsGuardrails.throughput = { min: parseFloat(mgThroughputMin) };
    
    const mgTotalRequestsMin = gwFields.mgTotalRequestsMin?.value;
    if (mgTotalRequestsMin) metricsGuardrails.totalRequests = { min: parseInt(mgTotalRequestsMin) };
    
    const mgFailedRequestsMax = gwFields.mgFailedRequestsMax?.value;
    if (mgFailedRequestsMax) metricsGuardrails.failedRequests = { max: parseInt(mgFailedRequestsMax) };
    
    const mgAvgRequestDurationMax = gwFields.mgAvgRequestDurationMax?.value;
    if (mgAvgRequestDurationMax) metricsGuardrails.averageRequestDuration = { max: parseInt(mgAvgRequestDurationMax) };
    
    if (Object.keys(metricsGuardrails).length > 0) {
        config.metricsGuardrails = { apiGateway: metricsGuardrails };
    }
    
    return { config, imports, needsEnums, genericsInfo, functionDefs };
}

// Generate formatted code output
function updateGwConfigOutput() {
    const { config, imports, needsEnums, genericsInfo, functionDefs } = generateGwConfig();
    const requests = getGwRequests();
    const functions = getGwFunctions();
    const groups = getGwGroups();
    
    let code = '';
    
    // Imports
    if (needsEnums) {
        imports.push('RETRY_STRATEGY');
    }
    code += `import { ${imports.join(', ')} } from '@emmvish/stable-infra';\n`;
    
    // Build generics string
    let genericsStr = '';
    if (genericsInfo.request || genericsInfo.response || genericsInfo.fnArgs || genericsInfo.fnReturn) {
        const parts = [
            genericsInfo.request || 'any',
            genericsInfo.response || 'any',
            genericsInfo.fnArgs || 'any[]',
            genericsInfo.fnReturn || 'any'
        ];
        genericsStr = `<${parts.join(', ')}>`;
    }
    
    // Add request groups to config
    if (groups.length > 0) {
        config.requestGroups = groups.map(g => {
            const group = { id: g.id };
            if (g.hostname) group.hostname = g.hostname;
            if (g.timeout) group.timeout = g.timeout;
            if (g.attempts) group.attempts = g.attempts;
            if (g.wait) group.wait = g.wait;
            if (g.retryStrategy) group.retryStrategy = `RETRY_STRATEGY.${g.retryStrategy.toUpperCase()}`;
            if (g.headers) group.headers = g.headers;
            return group;
        });
    }
    
    // Generate items array
    if (requests.length > 0 || functions.length > 0) {
        code += '\n';
        
        // Generate requests
        if (requests.length > 0) {
            code += 'const requests = [\n';
            requests.forEach((req, i) => {
                code += '  {\n';
                code += `    id: '${req.id}'`;
                if (req.groupId) code += `,\n    groupId: '${req.groupId}'`;
                code += `,\n    requestOptions: {\n`;
                
                const opts = req.requestOptions;
                const optLines = [];
                
                optLines.push(`      path: '${opts.path}'`);
                if (opts.method) optLines.push(`      method: '${opts.method}'`);
                if (opts.hostname) optLines.push(`      hostname: '${opts.hostname}'`);
                if (opts.timeout) optLines.push(`      timeout: ${opts.timeout}`);
                if (opts.data) optLines.push(`      data: ${JSON.stringify(opts.data, null, 2).split('\n').map((l, j) => j > 0 ? '      ' + l : l).join('\n')}`);
                if (opts.headers) optLines.push(`      headers: ${JSON.stringify(opts.headers, null, 2).split('\n').map((l, j) => j > 0 ? '      ' + l : l).join('\n')}`);
                if (opts.attempts) optLines.push(`      attempts: ${opts.attempts}`);
                if (opts.wait) optLines.push(`      wait: ${opts.wait}`);
                if (opts.retryStrategy) optLines.push(`      retryStrategy: RETRY_STRATEGY.${opts.retryStrategy.toUpperCase()}`);
                if (opts.responseAnalyzer) optLines.push(`      responseAnalyzer: ${opts.responseAnalyzer}`);
                if (opts.finalErrorAnalyzer) optLines.push(`      finalErrorAnalyzer: ${opts.finalErrorAnalyzer}`);
                if (opts.preExecution) optLines.push(`      preExecution: { hook: ${opts.preExecution.hook} }`);
                if (opts.cache) {
                    let cacheStr = '      cache: { ';
                    const cacheParts = [];
                    if (opts.cache.ttlMs) cacheParts.push(`ttlMs: ${opts.cache.ttlMs}`);
                    if (opts.cache.keyGenerator) cacheParts.push(`keyGenerator: ${opts.cache.keyGenerator}`);
                    cacheStr += cacheParts.join(', ') + ' }';
                    optLines.push(cacheStr);
                }
                
                code += optLines.join(',\n');
                code += '\n    }\n  }';
                if (i < requests.length - 1) code += ',';
                code += '\n';
            });
            code += '];\n';
        }
        
        // Generate functions
        if (functions.length > 0) {
            code += '\nconst functions = [\n';
            functions.forEach((fn, i) => {
                code += '  {\n';
                code += `    id: '${fn.id}'`;
                if (fn.groupId) code += `,\n    groupId: '${fn.groupId}'`;
                code += `,\n    functionOptions: {\n`;
                
                const opts = fn.functionOptions;
                const optLines = [];
                
                optLines.push(`      fn: ${opts.fn}`);
                if (opts.args) optLines.push(`      args: ${JSON.stringify(opts.args)}`);
                if (opts.executionTimeout) optLines.push(`      executionTimeout: ${opts.executionTimeout}`);
                if (opts.returnResult) optLines.push(`      returnResult: true`);
                if (opts.attempts) optLines.push(`      attempts: ${opts.attempts}`);
                if (opts.wait) optLines.push(`      wait: ${opts.wait}`);
                if (opts.retryStrategy) optLines.push(`      retryStrategy: RETRY_STRATEGY.${opts.retryStrategy.toUpperCase()}`);
                if (opts.responseAnalyzer) optLines.push(`      responseAnalyzer: ${opts.responseAnalyzer}`);
                if (opts.finalErrorAnalyzer) optLines.push(`      finalErrorAnalyzer: ${opts.finalErrorAnalyzer}`);
                if (opts.preExecution) optLines.push(`      preExecution: { hook: ${opts.preExecution.hook} }`);
                if (opts.cache) {
                    let cacheStr = '      cache: { ';
                    const cacheParts = [];
                    if (opts.cache.ttlMs) cacheParts.push(`ttlMs: ${opts.cache.ttlMs}`);
                    if (opts.cache.keyGenerator) cacheParts.push(`keyGenerator: ${opts.cache.keyGenerator}`);
                    cacheStr += cacheParts.join(', ') + ' }';
                    optLines.push(cacheStr);
                }
                
                code += optLines.join(',\n');
                code += '\n    }\n  }';
                if (i < functions.length - 1) code += ',';
                code += '\n';
            });
            code += '];\n';
        }
    }
    
    // Generate options
    const hasConfig = Object.keys(config).length > 0;
    const hasRequests = requests.length > 0;
    const hasFunctions = functions.length > 0;
    
    code += '\n';
    
    if (hasConfig) {
        code += `const options = ${formatGwConfigValue(config, 2)};\n\n`;
    }
    
    // Generate call
    if (hasRequests || hasFunctions) {
        const itemsArg = hasRequests && hasFunctions 
            ? '[...requests, ...functions]' 
            : (hasRequests ? 'requests' : 'functions');
        
        if (hasConfig) {
            code += `const result = await stableApiGateway${genericsStr}(${itemsArg}, options);`;
        } else {
            code += `const result = await stableApiGateway${genericsStr}(${itemsArg});`;
        }
    } else {
        // No items yet
        code += '// Add requests using the "Add Request" button above\n\n';
        if (hasConfig) {
            code += `const result = await stableApiGateway${genericsStr}(requests, options);`;
        } else {
            code += `const result = await stableApiGateway${genericsStr}(requests, {\n  concurrentExecution: true\n});`;
        }
    }
    
    const codeElement = document.getElementById('gw-config-output-code');
    if (codeElement) {
        codeElement.textContent = code;
        if (window.Prism) {
            Prism.highlightElement(codeElement);
        }
    }
}

// Format config value for gateway (handles function references)
function formatGwConfigValue(value, baseIndent = 0, currentIndent = 0) {
    const indent = '  '.repeat(currentIndent);
    const nextIndent = '  '.repeat(currentIndent + 1);
    
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    
    if (typeof value === 'string') {
        // Check if it's a function reference or enum
        if (value.startsWith('RETRY_STRATEGY.') || 
            value.includes('=>') ||
            value.startsWith('(') ||
            /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(value)) {
            return value;
        }
        return `'${value.replace(/'/g, "\\'")}'`;
    }
    
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    
    if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        const items = value.map(item => formatGwConfigValue(item, baseIndent, currentIndent + 1));
        return `[\n${nextIndent}${items.join(`,\n${nextIndent}`)}\n${indent}]`;
    }
    
    if (typeof value === 'object') {
        const entries = Object.entries(value);
        if (entries.length === 0) return '{}';
        
        const lines = entries.map(([key, val]) => {
            const formattedVal = formatGwConfigValue(val, baseIndent, currentIndent + 1);
            return `${nextIndent}${key}: ${formattedVal}`;
        });
        
        return `{\n${lines.join(',\n')}\n${indent}}`;
    }
    
    return String(value);
}

function copyGwGeneratedCode() {
    const code = document.getElementById('gw-config-output-code')?.textContent;
    if (code) {
        navigator.clipboard.writeText(code).then(() => {
            showCopyFeedback('Code copied!');
        });
    }
}

function resetGwConfigBuilder() {
    // Reset all fields
    Object.values(gwFields).forEach(field => {
        if (!field) return;
        if (field.type === 'checkbox') {
            // Reset checkboxes based on their defaults
            if (field.id === 'gw-concurrentExecution') {
                field.checked = true;
            } else {
                field.checked = false;
            }
        } else if (field.tagName === 'SELECT') {
            field.selectedIndex = 0;
        } else {
            field.value = '';
        }
    });
    
    // Reset defaults for specific fields
    if (gwFields.commonAttempts) gwFields.commonAttempts.value = '1';
    if (gwFields.commonWait) gwFields.commonWait.value = '1000';
    if (gwFields.commonMaxAllowedWait) gwFields.commonMaxAllowedWait.value = '60000';
    if (gwFields.commonJitter) gwFields.commonJitter.value = '0';
    if (gwFields.commonMaxSerializableChars) gwFields.commonMaxSerializableChars.value = '1000';
    if (gwFields.cbHalfOpenMaxRequests) gwFields.cbHalfOpenMaxRequests.value = '5';
    if (gwFields.cbSuccessThresholdPercentage) gwFields.cbSuccessThresholdPercentage.value = '50';
    
    // Clear dynamic items
    const requestsContainer = document.getElementById('gw-requests-container');
    const functionsContainer = document.getElementById('gw-functions-container');
    const groupsContainer = document.getElementById('gw-groups-container');
    if (requestsContainer) requestsContainer.innerHTML = '';
    if (functionsContainer) functionsContainer.innerHTML = '';
    if (groupsContainer) groupsContainer.innerHTML = '';
    
    // Reset conditional fields
    const cacheFields = document.getElementById('gwCacheConfigFields');
    const trialModeFields = document.getElementById('gwTrialModeConfigFields');
    const functionCacheFields = document.getElementById('gwFunctionCacheConfigFields');
    if (cacheFields) cacheFields.classList.add('disabled');
    if (trialModeFields) trialModeFields.classList.add('disabled');
    if (functionCacheFields) functionCacheFields.classList.add('disabled');
    
    gwRequestCounter = 0;
    gwFunctionCounter = 0;
    gwGroupCounter = 0;
    
    updateGwConfigOutput();
}

function initStableApiGatewayBuilder() {
    gwFields = {
        // Generics
        genericRequest: document.getElementById('gw-generic-request'),
        genericResponse: document.getElementById('gw-generic-response'),
        genericFnArgs: document.getElementById('gw-generic-fnArgs'),
        genericFnReturn: document.getElementById('gw-generic-fnReturn'),
        
        // Execution mode
        concurrentExecution: document.getElementById('gw-concurrentExecution'),
        stopOnFirstError: document.getElementById('gw-stopOnFirstError'),
        enableRacing: document.getElementById('gw-enableRacing'),
        maxTimeout: document.getElementById('gw-maxTimeout'),
        
        // Common request data
        commonRequestDataHostname: document.getElementById('gw-commonRequestData-hostname'),
        commonRequestDataProtocol: document.getElementById('gw-commonRequestData-protocol'),
        commonRequestDataPort: document.getElementById('gw-commonRequestData-port'),
        commonRequestDataMethod: document.getElementById('gw-commonRequestData-method'),
        commonRequestDataTimeout: document.getElementById('gw-commonRequestData-timeout'),
        commonRequestDataHeaders: document.getElementById('gw-commonRequestData-headers'),
        commonRequestDataQuery: document.getElementById('gw-commonRequestData-query'),
        commonRequestDataBody: document.getElementById('gw-commonRequestData-body'),
        commonResReq: document.getElementById('gw-commonResReq'),
        
        // Common retry config
        commonAttempts: document.getElementById('gw-commonAttempts'),
        commonRetryStrategy: document.getElementById('gw-commonRetryStrategy'),
        commonWait: document.getElementById('gw-commonWait'),
        commonMaxAllowedWait: document.getElementById('gw-commonMaxAllowedWait'),
        commonJitter: document.getElementById('gw-commonJitter'),
        commonPerformAllAttempts: document.getElementById('gw-commonPerformAllAttempts'),
        
        // Common function config
        commonExecutionTimeout: document.getElementById('gw-commonExecutionTimeout'),
        commonReturnResult: document.getElementById('gw-commonReturnResult'),
        
        // Common analysis hooks
        commonResponseAnalyzer: document.getElementById('gw-commonResponseAnalyzer'),
        commonFinalErrorAnalyzer: document.getElementById('gw-commonFinalErrorAnalyzer'),
        commonFunctionResponseAnalyzer: document.getElementById('gw-commonFunctionResponseAnalyzer'),
        commonFinalFunctionErrorAnalyzer: document.getElementById('gw-commonFinalFunctionErrorAnalyzer'),
        
        // Common pre-execution
        commonPreExecutionHook: document.getElementById('gw-commonPreExecution-hook'),
        commonPreExecutionInputParams: document.getElementById('gw-commonPreExecution-inputParams'),
        commonFunctionPreExecutionHook: document.getElementById('gw-commonFunctionPreExecution-hook'),
        commonFunctionPreExecutionInputParams: document.getElementById('gw-commonFunctionPreExecution-inputParams'),
        
        // Common observability
        commonLogAllErrors: document.getElementById('gw-commonLogAllErrors'),
        commonLogAllSuccessfulAttempts: document.getElementById('gw-commonLogAllSuccessfulAttempts'),
        commonHandleErrors: document.getElementById('gw-commonHandleErrors'),
        commonHandleSuccessfulAttemptData: document.getElementById('gw-commonHandleSuccessfulAttemptData'),
        commonHandleFunctionErrors: document.getElementById('gw-commonHandleFunctionErrors'),
        commonHandleSuccessfulFunctionAttemptData: document.getElementById('gw-commonHandleSuccessfulFunctionAttemptData'),
        commonMaxSerializableChars: document.getElementById('gw-commonMaxSerializableChars'),
        
        // Common hook params
        commonHookParamsResponseAnalyzer: document.getElementById('gw-commonHookParams-responseAnalyzer'),
        commonHookParamsHandleSuccessful: document.getElementById('gw-commonHookParams-handleSuccessful'),
        commonHookParamsHandleErrors: document.getElementById('gw-commonHookParams-handleErrors'),
        commonHookParamsFinalError: document.getElementById('gw-commonHookParams-finalError'),
        commonFunctionHookParamsResponseAnalyzer: document.getElementById('gw-commonFunctionHookParams-responseAnalyzer'),
        commonFunctionHookParamsHandleSuccessful: document.getElementById('gw-commonFunctionHookParams-handleSuccessful'),
        commonFunctionHookParamsHandleErrors: document.getElementById('gw-commonFunctionHookParams-handleErrors'),
        commonFunctionHookParamsFinalError: document.getElementById('gw-commonFunctionHookParams-finalError'),
        
        // Common request caching
        commonCacheEnabled: document.getElementById('gw-commonCache-enabled'),
        commonCacheTtl: document.getElementById('gw-commonCache-ttlMs'),
        commonCacheMaxSize: document.getElementById('gw-commonCache-maxSize'),
        commonCacheKeyGenerator: document.getElementById('gw-commonCache-keyGenerator'),
        commonCacheStaleWhileRevalidate: document.getElementById('gw-commonCache-staleWhileRevalidate'),
        commonCacheStaleIfError: document.getElementById('gw-commonCache-staleIfError'),
        
        // Common function caching
        commonFunctionCacheEnabled: document.getElementById('gw-commonFunctionCache-enabled'),
        commonFunctionCacheTtl: document.getElementById('gw-commonFunctionCache-ttlMs'),
        commonFunctionCacheMaxSize: document.getElementById('gw-commonFunctionCache-maxSize'),
        commonFunctionCacheKeyGenerator: document.getElementById('gw-commonFunctionCache-keyGenerator'),
        
        // Common state persistence
        commonStatePersistenceOnStateChange: document.getElementById('gw-commonStatePersistence-onStateChange'),
        commonStatePersistenceOnCompletion: document.getElementById('gw-commonStatePersistence-onCompletion'),
        
        // Common trial mode
        commonTrialModeEnabled: document.getElementById('gw-commonTrialMode-enabled'),
        commonTrialModeMockData: document.getElementById('gw-commonTrialMode-mockData'),
        commonTrialModeMockLatencyMs: document.getElementById('gw-commonTrialMode-mockLatencyMs'),
        
        // Rate limiting & concurrency
        maxConcurrentRequests: document.getElementById('gw-maxConcurrentRequests'),
        rateLimitMaxRequests: document.getElementById('gw-rateLimit-maxRequests'),
        rateLimitWindowMs: document.getElementById('gw-rateLimit-windowMs'),
        
        // Circuit breaker
        cbFailureThresholdPercentage: document.getElementById('gw-cb-failureThresholdPercentage'),
        cbMinimumRequests: document.getElementById('gw-cb-minimumRequests'),
        cbRecoveryTimeoutMs: document.getElementById('gw-cb-recoveryTimeoutMs'),
        cbHalfOpenMaxRequests: document.getElementById('gw-cb-halfOpenMaxRequests'),
        cbSuccessThresholdPercentage: document.getElementById('gw-cb-successThresholdPercentage'),
        cbTrackSlowCalls: document.getElementById('gw-cb-trackSlowCalls'),
        cbSlowCallDurationMs: document.getElementById('gw-cb-slowCallDurationMs'),
        cbSlowCallThresholdPercentage: document.getElementById('gw-cb-slowCallThresholdPercentage'),
        
        // Shared buffer
        sharedBuffer: document.getElementById('gw-sharedBuffer'),
        
        // Execution context
        ecWorkflowId: document.getElementById('gw-ec-workflowId'),
        ecPhaseId: document.getElementById('gw-ec-phaseId'),
        ecBranchId: document.getElementById('gw-ec-branchId'),
        ecRequestId: document.getElementById('gw-ec-requestId'),
        
        // Metrics guardrails
        mgSuccessRateMin: document.getElementById('gw-mg-successRate-min'),
        mgExecutionTimeMax: document.getElementById('gw-mg-executionTime-max'),
        mgThroughputMin: document.getElementById('gw-mg-throughput-min'),
        mgTotalRequestsMin: document.getElementById('gw-mg-totalRequests-min'),
        mgFailedRequestsMax: document.getElementById('gw-mg-failedRequests-max'),
        mgAvgRequestDurationMax: document.getElementById('gw-mg-avgRequestDuration-max')
    };
    
    // Add event listeners to all fields
    Object.entries(gwFields).forEach(([name, field]) => {
        if (!field) return;
        field.addEventListener('input', updateGwConfigOutput);
        field.addEventListener('change', updateGwConfigOutput);
    });
    
    updateGwConfigOutput();
}
*/

// Run initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initConfigBuilder();
        initStableFunctionBuilder();
        initStableBufferBuilder();
        // stableApiGateway builder disabled (premium)
    });
} else {
    initConfigBuilder();
    initStableFunctionBuilder();
    initStableBufferBuilder();
    // stableApiGateway builder disabled (coming soon)
}
