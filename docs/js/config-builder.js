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
const comingSoonModules = ['stableApiGateway', 'stableWorkflow', 'stableWorkflowGraph', 'StableScheduler'];

function updateBuilderModule(selectedModule) {
    // Update status indicator
    if (comingSoonModules.includes(selectedModule)) {
        moduleStatus.textContent = '(Coming Soon)';
        moduleStatus.classList.add('coming-soon');
    } else {
        moduleStatus.textContent = '';
        moduleStatus.classList.remove('coming-soon');
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
    
    let importLine = `import { ${imports.join(', ')} } from '@emmvish/stable-request';`;
    
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
    
    let importLine = `import { ${imports.join(', ')} } from '@emmvish/stable-request';`;
    
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
    
    let importLine = `import { StableBuffer } from '@emmvish/stable-request';`;
    
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

// Run initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initConfigBuilder();
        initStableFunctionBuilder();
        initStableBufferBuilder();
    });
} else {
    initConfigBuilder();
    initStableFunctionBuilder();
    initStableBufferBuilder();
}
