exports.applyPanelConfig = async function(panelKey) {
    const { ipcRenderer } = require('electron');
    const path = require('path');
    
    const result = await ipcRenderer.invoke('get-current-config');
    const currentConfigPath = result.path;
    const configData = result.data;
    
    if (!configData) return { configData, currentConfigPath };
    
    const panelConfig = configData[panelKey] || {};

    if (panelConfig.panel_bg_color) {
        document.documentElement.style.backgroundColor = panelConfig.panel_bg_color;
    }

    if (panelConfig.panel_bg_image && currentConfigPath) {
        const rootDir = path.dirname(currentConfigPath);
        const fullImgPath = path.join(rootDir, panelConfig.panel_bg_image);
        const bgImg = document.getElementById('bg-image');
        bgImg.src = `file:///${fullImgPath.replace(/\\/g, '/')}`;
        bgImg.style.display = 'block';
        
        if (panelConfig.panel_bg_image_opacity !== undefined) {
            bgImg.style.opacity = panelConfig.panel_bg_image_opacity;
        }

        if (panelConfig.panel_bg_image_size) {
            if (typeof panelConfig.panel_bg_image_size === 'object') {
                if (panelConfig.panel_bg_image_size.width) bgImg.style.width = panelConfig.panel_bg_image_size.width + 'px';
                if (panelConfig.panel_bg_image_size.height) bgImg.style.height = panelConfig.panel_bg_image_size.height + 'px';
            } else {
                bgImg.style.width = typeof panelConfig.panel_bg_image_size === 'number' ? 
                    panelConfig.panel_bg_image_size + 'px' : panelConfig.panel_bg_image_size;
            }
        } else {
            bgImg.style.width = '200px';
        }
    }

    const glassLayer = document.getElementById('glass-layer');
    if (panelConfig.glass_layer_blur !== undefined && glassLayer) {
        const blurVal = typeof panelConfig.glass_layer_blur === 'number' ? `${panelConfig.glass_layer_blur}px` : panelConfig.glass_layer_blur;
        glassLayer.style.backdropFilter = `blur(${blurVal})`;
    }
    
    return { configData, currentConfigPath };
};
