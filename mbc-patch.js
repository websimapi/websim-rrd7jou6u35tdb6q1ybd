/**
 * MBC-Patch.js
 * 
 * This patch fixes the MBC3 clock issue by more directly intercepting the relevant code paths
 */

(function() {
    // Flag to track if the patch has been successfully applied
    let patchApplied = false;
    
    function applyPatch() {
        console.log("Attempting to apply MBC3 clock patch...");
        
        try {
            // 1. First, patch the UnimplementedException handling to make cartridge clock errors non-fatal
            if (GameboyJS && GameboyJS.Gameboy) {
                const originalHandleException = GameboyJS.Gameboy.prototype.handleException;
                GameboyJS.Gameboy.prototype.handleException = function(e) {
                    // Check if this is a cartridge clock not supported error
                    if (e instanceof GameboyJS.UnimplementedException && 
                        e.message === 'cartridge clock not supported') {
                        console.log("MBC3 clock error intercepted and ignored");
                        e.fatal = false; // Make it non-fatal
                        return; // Don't propagate this error
                    }
                    
                    // Call original handler for other errors
                    return originalHandleException.call(this, e);
                };
                console.log("Exception handler patched successfully");
            }
            
            // 2. Direct MBC3 patch
            if (GameboyJS && GameboyJS.MBC) {
                // Find the MBC3 prototype directly through the constructor in getMbcInstance function
                const originalGetMbcInstance = GameboyJS.MBC.getMbcInstance;
                
                GameboyJS.MBC.getMbcInstance = function(memory, type) {
                    // Call the original function to get the instance
                    const instance = originalGetMbcInstance.call(this, memory, type);
                    
                    // Only patch MBC3 types (0x0F-0x13)
                    if (type >= 0x0F && type <= 0x13) {
                        // Save the original manageWrite method
                        const originalManageWrite = instance.manageWrite;
                        
                        // Replace with our patched version
                        instance.manageWrite = function(addr, value) {
                            // Check if this is a clock register operation
                            if ((addr & 0xF000) === 0x6000 || (addr & 0xF000) === 0x7000) {
                                // Simply ignore the clock register operations
                                return;
                            }
                            
                            // For all other operations, call the original method
                            return originalManageWrite.call(this, addr, value);
                        };
                        
                        console.log("MBC3 instance patched successfully");
                    }
                    
                    return instance;
                };
                
                patchApplied = true;
                console.log("MBC3 clock patch applied successfully");
            } else {
                console.error("GameboyJS.MBC not found, will retry later");
                if (!patchApplied) {
                    setTimeout(applyPatch, 1000); // Retry after 1 second
                }
            }
        } catch (e) {
            console.error("Error applying MBC3 patch:", e);
            if (!patchApplied) {
                setTimeout(applyPatch, 1000); // Retry after 1 second
            }
        }
    }

    // Apply the patch when the page loads or retry a couple of times
    if (document.readyState === 'complete') {
        applyPatch();
    } else {
        window.addEventListener('load', applyPatch);
    }
})();