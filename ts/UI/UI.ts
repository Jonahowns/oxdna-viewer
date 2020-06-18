// Use Metro GUI
declare var Metro: any;

function drawSystemHierarchy() {
    let checkboxhtml = (label)=> `<input data-role="checkbox" data-caption="${label}">`;
    const content: HTMLElement = document.getElementById("hierarchyContent");
    content.innerText = '';

    let tv = Metro.makePlugin("#hierarchyContent", "treeview", {
        onCheckClick: (state, check, node, tree) => {
            let n = $(node);
            let element: BasicElement = n.data('monomer');
            if (element) {
                if (check.checked) {element.select()}
                else {element.deselect()}
                updateView(element.getSystem());
                return;
            }
            let strand: Strand = n.data('strand');
            if (strand) {
                if (check.checked) {strand.select()}
                else {strand.deselect()}
                updateView(strand.system);
                return;
            }
            let system = n.data('system');
            if (system) {
                if (check.checked) {system.select()}
                else {system.deselect()}
                updateView(system);
                return;
            }
        }
    });
    let treeview = tv.data('treeview');

    // Add checkbox nodes for, systems, strands and monomers
    systems.forEach(system=>{
        let systemNode = treeview.addTo(null, {
            html: checkboxhtml(system.label ? system.label : `System ${system.systemID}`)
        })
        systemNode.data('system', system);
        system.strands.forEach(strand=>{
            let strandNode = treeview.addTo(systemNode, {
                html: checkboxhtml(strand.label ? strand.label : `Strand ${strand.strandID}`)
            })
            strandNode.data('strand', strand);
            strand.monomers.forEach(monomer => {
                let color = monomer.elemToColor(monomer.type).getHexString();
                let monomerNode = treeview.addTo(strandNode, {
                    html: checkboxhtml(`gid: ${monomer.gid}`.concat(
                        monomer.label ? ` (${monomer.label})` : "")) +
                        `<span style="background:#${color}4f">${monomer.type}</span>`,
                    cls: color
                })
                // Save reference to monomer in node:
                monomerNode.data('monomer', monomer);

                // Add listeners for if node is toggled
                let checkbox = monomerNode.find("input")[0];
                monomer['addEventListener']('selected', ()=>{
                    checkbox.checked = true;
                    treeview._recheck(tv);
                });
                monomer['addEventListener']('deselected', ()=>{
                    checkbox.checked = false;
                    treeview._recheck(tv);
                });
            });
        });
    });
}

function handleMenuAction(event: String) {
    switch (event) {
        case "undo": editHistory.undo(); break;
        case "redo": editHistory.redo(); break;
        case "del": deleteWrapper(); break;
        case "cut": cutWrapper(); break;
        case "copy": copyWrapper(); break;
        case "paste": pasteWrapper(false); break;
        case "all": selectAll(); break;
        case "invert": invertSelection(); break;
        case "clear": clearSelection(); break;
    }
}

function updateColorPalette() {
    const opt: HTMLElement = document.getElementById("colorPaletteContent");
    if (!opt.hidden) {
        opt.innerHTML = "";  //Clear content

        //modifies the backboneColors array
        for (let i = 0; i < backboneColors.length; i++) {
            let m = backboneColors[i];
            let c = document.createElement('input');
            c.type = 'color';
            c.value = "#" + m.getHexString();
            c.onchange = function () {
                backboneColors[i] = new THREE.Color(c.value);
                updateColorPalette();
            }
            
            //deletes color on right click
            c.oncontextmenu = function (event) {
                event.preventDefault();
                backboneColors.splice(i, 1);
                updateColorPalette();
                return false;
            }
            opt.appendChild(c);
        }

        //actually update things in the scene
        elements.forEach(e=>{
            if (!selectedBases.has(e)) {
                e.updateColor();
            }
        });
        systems.forEach(s=> {
            s.callUpdates(['instanceColor'])
        });

        tmpSystems.forEach(s => {
            s.callUpdates(['instanceColor'])
        });

        render();
    }
};

function initLutCols(systems: System[]) {
    for (let i = 0; i < systems.length; i++) {
        const system = systems[i];
        for (let j = 0; j < system.bbColors.length; j += 3) {
            const r = system.bbColors[j];
            const g = system.bbColors[j + 1];
            const b = system.bbColors[j + 2];
            
            system.lutCols[j/3] = new THREE.Color(r,g,b);
        }
    }
}

function colorSelection() {
    const opt: HTMLElement = document.getElementById("colorSelectionContent");
    if(!opt.hidden) {
        opt.innerHTML = ""; // clear content
        const setButton = document.createElement('button');
        const resetButton = document.createElement('button');
        setButton.innerText = "Set Color";
        resetButton.innerText = "Reset Colors";

        // create color map with selected color
        setButton.onclick = () => {
            const selectedColor = new THREE.Color(colorInput.value);

            if (lut == undefined) {
                lut = new THREE.Lut(defaultColormap, 512);
                // legend needed to set 'color by' to Overlay, gets removed later
                lut.setLegendOn();
                lut.setLegendLabels();
            }
            else {
                const emptyTmpSystems = tmpSystems.filter(tmpSys => tmpSys.lutCols.length == 0)
                if (emptyTmpSystems.length > 0) {
                    console.log(emptyTmpSystems)
                    initLutCols(emptyTmpSystems)
                }
                view.setColoringMode("Overlay");
            }

            initLutCols(systems);
            initLutCols(tmpSystems);

            selectedBases.forEach(e => {
                let sid;
                if (e.dummySys) {
                    sid = e["gid"] - e.dummySys.globalStartId;
                    e.dummySys.lutCols[e.sid] = selectedColor;
                }
                sid = e["gid"] - e.getSystem().globalStartId;
                e.getSystem().lutCols[sid] = selectedColor;
            });
            
            view.setColoringMode("Overlay");
            if (!systems.some(system => system.colormapFile)) {
                api.removeColorbar();
            }
            clearSelection();
        }

        resetButton.onclick = () => {
            view.setColoringMode("Strand");
            initLutCols(systems);
            initLutCols(tmpSystems);
            clearSelection();
        }
        
        let colorInput = document.createElement('input');
        colorInput.type = 'color';
        opt.appendChild(colorInput);
        opt.appendChild(setButton);
        opt.appendChild(resetButton);
    }
};

function toggleVisArbitrary() {
    // arbitrary visibility toggling
    // toggle hidden monomers
    if (selectedBases.size == 0) {
        systems.forEach(system=>{
            system.strands.forEach(strand=>{
                strand.monomers.forEach(monomer=>{
                    if(monomer.getInstanceParameter3("visibility").x == 0)
                        monomer.toggleVisibility();
                });
            });
        });
    }
    // toggle selected monomers
    else {
        selectedBases.forEach(e => e.toggleVisibility());
    }
    
    systems.forEach(sys => sys.callUpdates(['instanceVisibility']));
    tmpSystems.forEach(tempSys => tempSys.callUpdates(['instanceVisibility']));
    clearSelection();
}

function notify(message: string, title?: string, opt?: any) {
    let n = Metro.notify;
    n.create(message, title, opt);
    console.info(`Notification: ${message}`);
}

class View {
    private doc: Document;
    basepairMessage = "Locating basepairs, please be patient...";

    constructor(doc: Document) {
        this.doc = doc;
    }

    private setToggleGroupValue(id: string, value: string) {
        let toggleGroup = this.doc.getElementById(id);
        let active = toggleGroup.querySelector('.active');
        if(active) {
            active.classList.remove('active');
        }
        for (let opt of toggleGroup.children) {
            if (opt.querySelector('.caption').innerHTML == value) {
                opt.classList.add('active');
                return;
            }
        }
    }

    private getToggleGroupValue(id: string): string {
        return this.doc.getElementById(id).querySelector('.active').querySelector('.caption').innerHTML;
    }

    public getRandomHue(): THREE.Color {
        return new THREE.Color(`hsl(${Math.random()*360}, 100%, 50%)`);
    }

    public getInputNumber(id: string): number {
        return (<HTMLInputElement>this.doc.getElementById(id)).valueAsNumber;
    }

    public getInputValue(id: string): string {
        return (<HTMLInputElement>this.doc.getElementById(id)).value;
    }

    public getInputBool(id: string): boolean {
        return (<HTMLInputElement>document.getElementById(id)).checked;
    }

    public isWindowOpen(id: string): boolean {
        let elem = this.doc.getElementById(id);
        if (elem) {
            // Should work but doesn't
            //return Metro.window.isOpen(elem);
            return elem.parentElement.parentElement.style.display != "none";
        } else {
            return false;
        }
        
    }

    public toggleWindow(id: string, oncreate?: ()=>void) {
        let elem = this.doc.getElementById(id);
        if (elem) {
            Metro.window.toggle(elem);
        } else {
            this.createWindow(id, oncreate);
        }
    }

    public createWindow(id: string, oncreate?: ()=>void) {
        fetch(`windows/${id}.json`)
            .then(response => response.json())
            .then(data => {
                let w = Metro.window.create(data);
                w[0].id = id;
                w.load(`windows/${id}.html`).then(oncreate);
            }
        );
    }

    public toggleModal(id: string) {
         ;
     }

    // nucleotides/strand/system
    public getSelectionMode(): string {
        return this.getToggleGroupValue('selectionScope');
    }

    public selectionEnabled() {
        return this.getSelectionMode() != "Disabled";
    }

    public selectPairs(): boolean {
        return (<HTMLInputElement>this.doc.getElementById("selectPairs")).checked;
    }

    public getCenteringSetting() {
        return this.getToggleGroupValue('centering');
    }

    public setCenteringSetting(setting: string) {
        return this.setToggleGroupValue('centering', setting);
    }

    public getInboxingSetting() {
        return this.getToggleGroupValue('inboxing');
    }

    public setInboxingSetting(setting: string) {
        return this.setToggleGroupValue('inboxing', setting);
    }

    public getTransformSetting() {
        return this.getToggleGroupValue('transform');
    }

    public transformEnabled() {
        return this.getTransformSetting() != "None";
    }

    public getColoringMode(): string {
        return this.getToggleGroupValue('coloringMode');
    }

    public setColoringMode(mode: string) {
        this.setToggleGroupValue('coloringMode', mode);
        updateColoring();
    };

    public handleTransformMode(mode: string) {
        // Make sure that buttons correspond to specified mode
        this.setToggleGroupValue('transform', mode);

        // If we should show something
        if (mode != "None") {
            // Make sure something is selected
            if (selectedBases.size > 0) {
                transformControls.show();
                transformControls.setMode(mode.toLowerCase());
            } else {
                notify("Please select elements to transform");
                // Reset buttons to none
                this.setToggleGroupValue('transform', 'None');
            }
        } else {
            transformControls.hide()
        }
    }

    public longCalculation(calc: () => void, message: string, callback?: () => void) {
        let activity = Metro.activity.open({
            type: 'square',
            overlayColor: '#fff',
            overlayAlpha: 1,
            text: message
        });

        // Set wait cursor and request an animation frame to make sure
    // that it gets changed before starting calculation:
    let dom = document.activeElement;
    dom['style'].cursor = "wait";
    requestAnimationFrame(() => requestAnimationFrame(() => {
        try {
           calc(); 
        } catch (error) {
           notify(`Sorry, something went wrong with the calculation: ${error}`);
        }

        // Change cursor back and remove modal
        dom['style'].cursor = "auto";
        Metro.activity.close(activity);
        if(callback) {
            callback();
        }
    }));
    }

}

let view = new View(document);