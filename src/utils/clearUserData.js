// Clears all app-specific localStorage data
// Used on logout and when a different user logs in

export const clearAppLocalStorage = () => {
    const keysToPreserve = [
        // Auth0 keys - let Auth0 handle these
        'auth0.is.authenticated',
    ];

    const appPrefixes = [
        'quickSOAP_',
        'quickQuery',
        'currentQuickSOAPReportId',
        'currentReportId',
        'currentReportText',
        'loadQuickSOAPData',
        'hasNewMobileSOAP',
        'newMobileSOAPId',
        'hasNewDesktopQuickSOAP',
        'newDesktopQuickSOAPId',
        'mobileSOAPCount',
        'pendingMobileDictation',
        'pendingMobileDictationId',
        'dismissedMobileDictations',
        'viewedMobileSOAPReports',
        'viewedDesktopQuickSOAPReports',
        'unopenedDesktopQuickSOAPReports',
        'savedReportsFilterType',
        'previewVisible',
        'patientInfoSubmitted',
        'openQuickSOAPTutorial',
        'openPetQueryTutorial',
        // ReportForm fields
        'form_data',
        'patientName',
        'species',
        'sex',
        'breed',
        'colorMarkings',
        'weight',
        'weightUnit',
        'age',
        'ownerName',
        'examDate',
        'doctor',
        'presentingComplaint',
        'history',
        'physicalExamFindings',
        'diagnosticTests',
        'assessment',
        'diagnosis',
        'differentialDiagnosis',
        'treatment',
        'clientCommunications',
        'planFollowUp',
        'naturopathicMedicine',
        'enabledFields',
        'customBreed',
    ];

    // Get all keys and remove app-specific ones
    const allKeys = Object.keys(localStorage);
    allKeys.forEach(key => {
        if (keysToPreserve.includes(key)) return;
        if (key.startsWith('@@auth0spajs@@')) return; // Let Auth0 handle its own keys
        
        // Remove if key matches any app prefix or is in the list
        const shouldRemove = appPrefixes.some(prefix => 
            key === prefix || key.startsWith(prefix)
        );
        
        if (shouldRemove) {
            localStorage.removeItem(key);
        }
    });
};

// Check if user changed and clear data if so
export const checkAndClearForUserChange = (currentUserId) => {
    if (!currentUserId) return;
    
    const lastUserId = localStorage.getItem('petwise_lastUserId');
    
    if (lastUserId && lastUserId !== currentUserId) {
        console.log('User changed, clearing localStorage data');
        clearAppLocalStorage();
    }
    
    localStorage.setItem('petwise_lastUserId', currentUserId);
};
