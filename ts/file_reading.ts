/// <reference path="./three/index.d.ts" />

// chunk .dat file so its not trying to read the entire thing at once
function dat_chunker(dat_file: Blob, current_chunk: number, chunk_size: number) {
    let sliced = dat_file.slice(current_chunk * chunk_size, current_chunk * chunk_size + chunk_size);
    return sliced;
}

function extract_next_conf() {
    let need_next_chunk: boolean = false;
    let current_chunk_lines: string[] = current_chunk.split(/[\n]+/g);
    let next_chunk_lines: string[] = next_chunk.split(/[\n]+/g);
    let current_chunk_length: number = current_chunk_lines.length;
    let next_conf: string[] = [];
    let start = new marker;
    if (conf_end.line_id != current_chunk_length) { //handle very rare edge case where conf ended exactly at end of chunk
        start.chunk = conf_end.chunk;
        start.line_id = conf_end.line_id + 1;
    }
    else {
        start.chunk = next_chunk;
        start.line_id = 0;
        need_next_chunk = true;
    }

    let end = new marker;
    if (start.line_id + conf_len <= current_chunk_length) { //is the whole conf in a single chunk?
        end.chunk = start.chunk;
        end.line_id = start.line_id + conf_len - 1;
        for (let i = start.line_id; i < end.line_id + 1; i++) {
            if (current_chunk_lines[i] == "" || current_chunk_lines == undefined) { return undefined }
            next_conf.push(current_chunk_lines[i]);
        }
    }
    else {
        end.chunk = next_chunk;
        end.line_id = conf_len - (current_chunk_length - start.line_id) - 1;
        need_next_chunk = true
        for (let i = start.line_id; i < current_chunk_length; i++) {
            if (current_chunk_lines[i] == "" || current_chunk_lines == undefined) { return undefined }
            next_conf.push(current_chunk_lines[i]);
        }
        for (let i = 0; i < end.line_id + 1; i++) {
            next_conf.push(next_chunk_lines[i]);
        }
    }
    conf_begin = start;
    conf_end = end;
    if (need_next_chunk) {
        get_next_chunk(dat_file, current_chunk_number + 2); //current is the old middle, so need two ahead
    } 
    else {
        // Signal that config has been loaded
        document.dispatchEvent(new Event('nextConfigLoaded'));
    }

    return (next_conf);
}

function extract_previous_conf() {
    let need_previous_chunk: boolean = false;
    let previous_conf: string[] = []
    let end = new marker;
    if (conf_begin.line_id != 0) { //handle rare edge case where a conf began at the start of a chunk
        end.chunk = conf_begin.chunk;
        if (end.chunk == previous_chunk) {
            need_previous_chunk = true;
        }
        end.line_id = conf_begin.line_id - 1;
    }
    else {
        end.chunk = previous_chunk;
        end.line_id = previous_chunk.length - 1;
        need_previous_chunk = true;
    }
    let end_chunk_lines: string[] = end.chunk.split(/[\n]+/g);

    let start = new marker;
    if (end.line_id - conf_len >= 0) { //is the whole conf in a single chunk?
        start.chunk = end.chunk;
        start.line_id = end.line_id - conf_len + 1;
        let start_chunk_lines: string[] = start.chunk.split(/[\n]+/g);
        for (let i = start.line_id; i < end.line_id + 1; i++) {
            if (start_chunk_lines[i] == "" || start_chunk_lines == undefined) { return undefined }
            previous_conf.push(start_chunk_lines[i]);
        }
    }
    else {
        if (end.chunk == current_chunk) {
            start.chunk = previous_chunk;
        }
        if (end.chunk == previous_chunk) {
            start.chunk = previous_previous_chunk;
        }
        let start_chunk_lines: string[] = start.chunk.split(/[\n]+/g);
        start.line_id = start_chunk_lines.length - (conf_len - (end.line_id + 1));
        for (let i = start.line_id; i < start_chunk_lines.length; i++) {
            if (start_chunk_lines[i] == "" || start_chunk_lines == undefined) { return undefined }
            previous_conf.push(start_chunk_lines[i]);
        }
        for (let i = 0; i < end.line_id + 1; i++) {
            if (end_chunk_lines[i] == "" || end_chunk_lines == undefined) { return undefined }
            previous_conf.push(end_chunk_lines[i]);
        }
    }
    conf_begin = start;
    conf_end = end;
    if (need_previous_chunk) {
        get_previous_chunk(dat_file, current_chunk_number - 3);
    }
    return (previous_conf);
}

function get_next_chunk(dat_file, chunk_number) {
    previous_previous_chunk = previous_chunk;
    p_p_hanging_line = p_hanging_line;
    previous_chunk = current_chunk;
    p_hanging_line = c_hanging_line;
    current_chunk = next_chunk;
    c_hanging_line = n_hanging_line;

    let next_chunk_blob = dat_chunker(dat_file, chunk_number, approx_dat_len);
    next_reader.readAsText(next_chunk_blob);
    current_chunk_number += 1;
}

function get_previous_chunk(dat_file, chunk_number) {
    next_chunk = current_chunk;
    n_hanging_line = c_hanging_line;
    current_chunk = previous_chunk;
    c_hanging_line = p_hanging_line;
    previous_chunk = previous_previous_chunk;
    p_hanging_line = p_p_hanging_line;

    if (chunk_number < 0) {
        console.log("tried to load conf -1");
        if (previous_previous_chunk == undefined) {
            previous_chunk = undefined;
        }
        else {
            previous_previous_chunk = undefined;
        }
        current_chunk_number -= 1;
        return
    }

    let previous_previous_chunk_blob = dat_chunker(dat_file, chunk_number, approx_dat_len);
    previous_previous_reader.readAsText(previous_previous_chunk_blob);
    current_chunk_number -= 1
}

class marker {
    chunk: String;
    line_id: number;
}

// define the drag and drop behavior of the scene 
var target = renderer.domElement;
target.addEventListener("dragover", function (event) {
    event.preventDefault();
}, false);

// the actual code to drop in the config files
//First, a bunch of global variables everybody loves
var approx_dat_len: number,
    current_chunk_number: number, //this is the chunk containing the end of the current conf
    previous_previous_chunk: String, //Space to store the chunks
    previous_chunk: String,
    current_chunk: String,
    next_chunk: String,
    p_p_hanging_line, //Deal with bad linebreaks caused by splitting the trajectory bitwise
    p_hanging_line,
    c_hanging_line,
    n_hanging_line,
    dat_reader = new FileReader(),
    next_reader = new FileReader(),
    previous_reader = new FileReader(), //previous and previous_previous are basicaly the same...
    previous_previous_reader = new FileReader(),
    conf_begin = new marker,
    conf_end = new marker,
    conf_len: number,
    conf_num: number = 0,
    dat_fileout: string = "",
    dat_file, //currently var so only 1 dat_file stored for all systems w/ last uploaded system's dat
    box: number; //box size for system


target.addEventListener("drop", function (event) {

    // cancel default actions
    event.preventDefault();

    //make system to store the dropped files in
    var system = new System(sys_count, elements.length);

    var files = event.dataTransfer.files,
        files_len = files.length;

    let top_file, json_file;

    // assign files to the extentions; all possible combinations of entered files
    for (let i = 0; i < files_len; i++) {
        // get file extension
        let file_name = files[i].name;
        let ext = file_name.split('.').pop();

        if (ext === "dat") dat_file = files[i];
        if (ext === "conf") dat_file = files[i];
        if (ext === "top") top_file = files[i];
        if (ext === "json") json_file = files[i];
    }
    let json_alone = false
    if (json_file && !top_file) json_alone = true;
    if ((files_len > 3 || files_len < 2) && !json_alone)  {
        alert("Please drag and drop 1 .dat and 1 .top file. .json is optional.  More .jsons can be dropped individually later");
        return
    }

    if (top_file) {
        //read topology file
        let top_reader = new FileReader();
        top_reader.onload = () => {
            // parse file into lines
            var file = top_reader.result as string
            var lines = file.split(/[\n]+/g);
            lines = lines.slice(1); // discard the header

            let l0 = lines[0].split(" "); //split the file and read each column, format is: "str_id base n3 n5"
            let str_id = parseInt(l0[0]);
            let current_strand: Strand = system.create_Strand(str_id);
            system.add_strand(current_strand);
            let nuc_local_id: number = 0;
            let last_strand: number = 1; //strands are 1-indexed in oxDNA .top files
            let neighbor3;


            // create empty list of elements with length equal to the topology
            // Note: this is implemented such that we have the elements for the DAT reader 
            for (let j = 0; j < lines.length; j++) {
                let nuc: DNANucleotide | RNANucleotide | AminoAcid;
                elements.push(nuc);
            }
            //elements[lines.length] =  null;
            lines.forEach(
                (line, i) => {
                    if (line == "") {
                        elements.pop();
                        //system.add_strand(current_strand);
                        return;
                    }
                    let l = line.split(" "); //split the file and read each column, format is: "str_id base n3 n5"
                    str_id = parseInt(l[0]);

                    if (str_id != last_strand) { //if new strand id, make new strand                        
                        current_strand = system.create_Strand(str_id);
                        system.add_strand(current_strand);
                        nuc_local_id = 0;
                    };

                    //let nuc = new Nucleotide(elements.length, current_strand);
                    if (elements[nuc_count + i] == null || elements[nuc_count + i] == undefined)
                        elements[nuc_count + i] = current_strand.create_basicElement(nuc_count + i);
                    let nuc = elements[nuc_count + i];
                    nuc.local_id = nuc_local_id;

                    neighbor3 = parseInt(l[2]);
                    if (neighbor3 != -1) {
                        nuc.neighbor3 = elements[nuc_count + neighbor3];
                    }
                    else {
                        nuc.neighbor3 = null;
                    }
                    let neighbor5 = parseInt(l[3]);
                    if (neighbor5 != -1) {
                        if (elements[nuc_count + neighbor5] == null || elements[nuc_count + neighbor5] == undefined) {
                            elements[nuc_count + neighbor5] = current_strand.create_basicElement(nuc_count + neighbor5);
                        }
                        nuc.neighbor5 = elements[nuc_count + neighbor5];
                    }
                    else {
                        nuc.neighbor5 = null;
                    }

                    let base = l[1]; // get base id
                    nuc.type = base;
                    //if we meet a U, we have an RNA (its dumb, but its all we got)
                    if (base === "U") {
                        RNA_MODE = true;
                    }

                    //let nuc = new Nucleotide(nuc_count, nuc_local_id, neighbor3_nuc, base, str_id, system.system_id); //create nucleotide
                    current_strand.add_basicElement(nuc); //add nuc into Strand object
                    //elements.push(nuc); //add nuc to global elements array
                    nuc_local_id += 1;
                    last_strand = str_id;

                    if (i == lines.length - 1) {
                        //system.add_strand(current_strand);
                        return;
                    };

                });

            system.setDatFile(dat_file); //store dat_file in current System object
            systems.push(system); //add system to Systems[]
            nuc_count = elements.length;
            conf_len = nuc_count + 3;

        };
        top_reader.readAsText(top_file);
        //test_dat_read(dat_file);


        // asynchronously read the first two chunks of a configuration file
        if (dat_file) {
            renderer.domElement.style.cursor = "wait";
            //anonymous functions to handle fileReader outputs
            dat_reader.onload = () => {
                current_chunk = dat_reader.result as String;
                current_chunk_number = 0;
                readDat(system.system_length(), dat_reader, system, lutColsVis);
                document.dispatchEvent(new Event('nextConfigLoaded'));
            };
            //chunking bytewise often leaves incomplete lines, so cut off the beginning of the new chunk and append it to the chunk before
            next_reader.onload = () => {
                next_chunk = next_reader.result as String;
                if (next_chunk == "") {
                    document.dispatchEvent(new Event('finalConfig'));
                    return;
                }
                n_hanging_line = "";
                let c = "";
                for (c = next_chunk.slice(0, 1); c != '\n'; c = next_chunk.slice(0, 1)) {
                    n_hanging_line += c;
                    next_chunk = next_chunk.substring(1);
                }
                try {
                    current_chunk = current_chunk.concat(n_hanging_line);
                }
                catch (error) {
                    alert("File readers got all topsy-turvy.  If trajectory reading does not work, reload and try again.")
                }
                next_chunk = next_chunk.substring(1);
                conf_end.chunk = current_chunk;

                // Signal that config has been loaded
                document.dispatchEvent(new Event('nextConfigLoaded'));
            };
            previous_previous_reader.onload = () => {
                previous_previous_chunk = previous_previous_reader.result as String;
                if (previous_previous_chunk == "") { return }
                p_p_hanging_line = "";
                let c = "";
                for (c = previous_previous_chunk.slice(0, 1); c != '\n'; c = previous_previous_chunk.slice(0, 1)) {
                    p_p_hanging_line += c;
                    previous_previous_chunk = previous_previous_chunk.substring(1);
                }
                previous_previous_chunk = previous_previous_chunk.substring(1);
                previous_previous_chunk = previous_previous_chunk.concat(p_hanging_line);
                conf_end.chunk = current_chunk;

                // Signal that config has been loaded
                document.dispatchEvent(new Event('nextConfigLoaded'));
            };

            // read the first chunk
            if (dat_file && top_file) {
                approx_dat_len = top_file.size * 30; //the relation between .top and a single .dat size is very variable, the largest I've found is 27x, although most are around 15x
                let first_chunk_blob = dat_chunker(dat_file, 0, approx_dat_len);
                dat_reader.readAsText(first_chunk_blob);

                //if its a trajectory, read in the second chunk
                if (dat_file.size > approx_dat_len) {
                    let next_chunk_blob = dat_chunker(dat_file, 1, approx_dat_len);
                    next_reader.readAsText(next_chunk_blob);
                }
            }

        }
    }



    if (json_file) {
        //lutColsVis = true;
        let check_box = <HTMLInputElement>document.getElementById("lutToggle");
        let json_reader = new FileReader(); //read .json
        json_reader.onload = () => {
            let file = json_reader.result as string;
            let data = JSON.parse(file);
            let curr_sys;
            if (json_alone) curr_sys = sys_count - 1;
            else curr_sys = sys_count;
            for (var key in data) {
                if (data[key].length == systems[curr_sys].system_length()) { //if json and dat files match/same length
                    if (!isNaN(data[key][0])) { //we assume that scalars denote a new color map
                        let min = Math.min.apply(null, data[key]), //find min and max
                            max = Math.max.apply(null, data[key]);
                        lut = new THREE.Lut("rainbow", 4000);
                        //lut.setMax(0.23);
                        //lut.setMin(0.04);
                        lut.setMax(max);
                        lut.setMin(min);
                        let legend = lut.setLegendOn({ 'layout': 'horizontal', 'position': { 'x': 0, 'y': 10, 'z': 0 } }); //create legend
                        scene.add(legend);
                        let labels = lut.setLegendLabels({ 'title': key, 'ticks': 5 }); //set up legend format
                        scene.add(labels['title']); //add title

                        for (let i = 0; i < Object.keys(labels['ticks']).length; i++) { //add tick marks
                            scene.add(labels['ticks'][i]);
                            scene.add(labels['lines'][i]);
                        }
                        for (let i = 0; i < elements.length; i++) { //insert lut colors into lutCols[] to toggle Lut coloring later
                            lutCols.push(lut.getColor(Number(data[key][i])));
                        }
                        if (!json_alone) lutColsVis = true;
                        check_box.checked = true;
                        if (json_alone) toggleLut(check_box);
                    }
                    if (data[key][0].length == 3) { //we assume that 3D vectors denote motion
                        for (let i = 0; i < elements.length; i++) {
                            let vec = new THREE.Vector3(data[key][i][0], data[key][i][1], data[key][i][2]);
                            let len = vec.length();
                            vec.normalize();
                            let arrowHelper = new THREE.ArrowHelper(vec, elements[i].visual_object.children[elements[i].BACKBONE].position, len, 0x000000);
                            arrowHelper.name = i + "disp";
                            scene.add(arrowHelper);
                        }
                    }
                }
                else if (data[key][0].length == 6) { //draw arbitrary arrows on the scene
                    for (let entry of data[key]) {
                        let pos = new THREE.Vector3(entry[0], entry[1], entry[2]);
                        let vec = new THREE.Vector3(entry[3], entry[4], entry[5]);
                        vec.normalize();
                        let arrowHelper = new THREE.ArrowHelper(vec, pos, 5 * vec.length(), 0x00000);
                        scene.add(arrowHelper);
                    }
                }
                else { //if json and dat files do not match, display error message and set files_len to 2 (not necessary)
                    alert(".json and .top files are not compatible.");
                }
            }
        };
        json_reader.readAsText(json_file);
        renderer.domElement.style.cursor = "auto";
    }

    render();
}, false);

let x_bb_last,
    y_bb_last,
    z_bb_last;
function readDat(num_nuc, dat_reader, system, lutColsVis) {
    var start = Date.now()
    var nuc_local_id = 0;
    var current_strand = systems[sys_count].strands[0];
    // parse file into lines 
    let lines = dat_reader.result.split(/[\n]+/g);
    if (lines.length-3 < num_nuc) { //Handles dat files that are too small.  can't handle too big here because you don't know if there's a trajectory
        alert(".dat and .top files incompatible")
        return
    }
    //get the simulation box size 
    box = parseFloat(lines[1].split(" ")[3]);
    let time = parseInt(lines[0].split(" ")[2]);
    conf_num += 1
    console.log(conf_num, "t =", time);
    // discard the header
    lines = lines.slice(3);

    conf_begin.chunk = current_chunk;
    conf_begin.line_id = 0;

    conf_end.chunk = current_chunk;
    conf_end.line_id = num_nuc + 2; //end of current configuration

    //set up the instancing with the number of particles
    instanced_backbone.maxInstancedCount = num_nuc;
    const arraySize = num_nuc*4;
    var matrixArray = [
        new Float32Array(arraySize),
        new Float32Array(arraySize),
        new Float32Array(arraySize),
        new Float32Array(arraySize)
    ]
    var attributeArray = []
    for( let i = 0 ; i < matrixArray.length ; i ++ ){
        const attribute = new THREE.InstancedBufferAttribute( matrixArray[i], 4 ) 
        attribute.dynamic = true

        attributeArray.push(attribute)
        instanced_backbone.addAttribute( 
           `aInstanceMatrix${i}`, 
           new THREE.InstancedBufferAttribute( matrixArray[i], 4 ) 
        )
    }
    const instanceColorArray = new Uint8Array(num_nuc*3);
    instanced_backbone.addAttribute(
        'aInstanceColor',
        new THREE.InstancedBufferAttribute( instanceColorArray, 3, 1 )
    );

    const instanceEmissiveArray = new Uint8Array(num_nuc*3)
    var instanceEmissive = new THREE.InstancedBufferAttribute( instanceEmissiveArray, 3, 1 )
    instanced_backbone.addAttribute(
        'aInstanceEmissive',
        instanceEmissive
      )

    // add the bases to the scene
    for (let i = 0; i < num_nuc; i++) {//from beginning to end of current configuration's list of positions; for each nucleotide in the system
        if (lines[i] == "" || lines[i].slice(0, 1) == 't') {
            break
        };
        var current_nucleotide: BasicElement = current_strand.elements[nuc_local_id];
        // consume a new line 
        let l: string = lines[i].split(" ");

        let x = parseFloat(l[0]),
            y = parseFloat(l[1]),
            z = parseFloat(l[2]);
        
        let x_a1 = parseFloat(l[3]),
            y_a1 = parseFloat(l[4]),
            z_a1 = parseFloat(l[5]),
            x_a3 = parseFloat(l[6]),
            y_a3 = parseFloat(l[7]),
            z_a3 = parseFloat(l[8]);

        let [x_a2, y_a2, z_a2] = cross(x_a1, y_a1, z_a1, x_a3, y_a3, z_a3);

        current_nucleotide.pos = new THREE.Vector3(x, y, z); //set pos; not updated by DragControls
        current_nucleotide.calculatePositions(x, y, z, l);

        var backbone = new THREE.Object3D();
        const test_color = new THREE.Color(0xfdd291);
        var backbone_color = new THREE.Color();
        backbone_color.copy(current_nucleotide.strand_to_material(current_nucleotide.parent.strand_id).color);
        console.log(backbone_color, test_color);

        let pos = current_nucleotide.calcBBPos(x, y, z, x_a1, y_a1, z_a1, x_a2, y_a2, z_a2, x_a3, y_a3, z_a3);
        backbone.position.set(pos.x, pos.y, pos.z );
        intersectsScene.add(backbone);
        backbone.updateMatrixWorld(true);
        
        //scene.add(current_nucleotide.visual_object.children[current_nucleotide.BACKBONE]);
        current_nucleotide.visual_object.children[current_nucleotide.BACKBONE].updateMatrixWorld(true);
        for ( let r = 0 ; r < 4 ; r ++ )
            for ( let c = 0 ; c < 4 ; c ++ ){
                matrixArray[r][i*4 + c] = backbone.matrixWorld.elements[r*4 + c];
        }
        const colorArray = backbone_color.toArray().map(col=>Math.floor(col*255))
        backbone.userData.color = colorArray;
        for( let c = 0 ; c < 3 ; c ++ ){
            instanceColorArray[i*3 + c] = colorArray[c];
        }

        //catch the two possible cases for strand ends (no connection or circular)
        if (current_nucleotide.neighbor5 == undefined || current_nucleotide.neighbor5 == null) { //if last nucleotide in linear strand
            system.system_3objects.add(current_strand.strand_3objects); //add strand THREE.Group to system THREE.Group
            nuc_local_id = -1;
            if (elements[current_nucleotide.global_id+1] != undefined) {
                current_strand = elements[current_nucleotide.global_id+1].parent;
            }
        }
        else if (current_nucleotide.neighbor5.local_id < current_nucleotide.local_id) { //if last nucleotide in circular strand
            system.system_3objects.add(current_strand.strand_3objects); //add strand THREE.Group to system THREE.Group
            nuc_local_id = -1;
            if (elements[current_nucleotide.global_id+1] != undefined) {
                current_strand = elements[current_nucleotide.global_id+1].parent;
            }
        }

        nuc_local_id += 1


        
    }
    intersectsScene.updateMatrixWorld(true);
    const instanceMaterial = new THREE.MeshLambertMaterial({
        side: THREE.DoubleSide
    });
    instanceMaterial.onBeforeCompile = shader=>{

        shader.vertexShader = `
    
        attribute vec4 aInstanceMatrix0;
        attribute vec4 aInstanceMatrix1;
        attribute vec4 aInstanceMatrix2;
        attribute vec4 aInstanceMatrix3;
    
    
        attribute vec3 aInstanceColor;
        attribute vec3 aInstanceEmissive;
        ${
            shader.vertexShader.replace(
                '#include <begin_vertex>',
                `
                mat4 aInstanceMatrix = mat4(
                    aInstanceMatrix0,
                    aInstanceMatrix1,
                    aInstanceMatrix2,
                    aInstanceMatrix3
                );
                vec3 transformed = (aInstanceMatrix * vec4( position , 1. )).xyz;
                `
            )
        }`
        shader.vertexShader = `
        varying vec3 vInstanceColor;
        varying vec3 vInstanceEmissive;
        ${
          shader.vertexShader.replace(
          `#include <color_vertex>`,
          `#include <color_vertex>
           vInstanceColor = aInstanceColor;
           vInstanceEmissive = aInstanceEmissive;
          `
        )}
        `
    
        shader.fragmentShader = `
        varying vec3 vInstanceColor;
        ${
          shader.fragmentShader.replace(
          'vec4 diffuseColor = vec4( diffuse, opacity );',
          'vec4 diffuseColor = vec4( vInstanceColor, opacity );'
        )}
        `
    
        shader.fragmentShader = `
        varying vec3 vInstanceEmissive;
        ${
          shader.fragmentShader.replace(
          'vec3 totalEmissiveRadiance = emissive;',
          'vec3 totalEmissiveRadiance = vInstanceEmissive;'
        )}
        `
    
        shader.vertexShader = shader.vertexShader.replace(
          `#include <beginnormal_vertex>`,
          `
          mat4 _aInstanceMatrix = mat4(
            aInstanceMatrix0,
            aInstanceMatrix1,
            aInstanceMatrix2,
            aInstanceMatrix3
          );
          vec3 objectNormal = (_aInstanceMatrix * vec4( normal, 0. ) ).xyz;
          `
        )
        
    }

    scene.add(new THREE.Mesh(
        instanced_backbone,
        instanceMaterial
    ))
    let dx, dy, dz;

    //bring strand in box
    for (let i = 0; i < systems[sys_count].strands.length; i++) { //for each strand in current system
        // compute offset to bring strand in box
        let n = systems[sys_count].strands[i].elements.length; //strand's elements[] length
        let cms = new THREE.Vector3(0, 0, 0); //center of mass
        for (let j = 0; j < n; j++) { //for every nuc in strand
            let bbint: number = systems[sys_count].strands[i].elements[j].getCOM();
            cms.add(systems[sys_count].strands[i].elements[j].visual_object.children[2].position); //sum center of masses - children[3] = posObj Mesh at cms
        }
        //cms calculations
        let mul = 1.0 / n;
        cms.multiplyScalar(mul);
        dx = Math.round(cms.x / box) * box;
        dy = Math.round(cms.y / box) * box;
        dz = Math.round(cms.z / box) * box;

        //fix coordinates
        for (let j = 0; j < systems[sys_count].strands[i].elements.length; j++) { //for every nucleotide in strand
            let current_nucleotide = systems[sys_count].strands[i].elements[j];
            for (let k = 0; k < systems[sys_count].strands[i].elements[j].visual_object.children.length; k++) { //for every Mesh in nucleotide's visual_object
                let pos = systems[sys_count].strands[i].elements[j].visual_object.children[k].position; //get Mesh position
                //update pos by offset <dx, dy, dz>
                pos.x = pos.x - dx;
                pos.y = pos.y - dy;
                pos.z = pos.z - dz;
                systems[sys_count].strands[i].elements[j].visual_object.children[k].position.set(pos.x, pos.y, pos.z);
            }
            current_nucleotide.visual_object.children.forEach(child => child.matrixAutoUpdate = false);
            current_nucleotide.visual_object.matrixAutoUpdate = false;
        }
        systems[sys_count].strands[i].strand_3objects.matrixAutoUpdate = false;
    }
    systems[sys_count].system_3objects.matrixAutoUpdate = false;

    scene.add(systems[sys_count].system_3objects); //add system_3objects with strand_3objects with visual_object with Meshes
    elements.forEach(e => e.visual_object.children.forEach(child => child.updateMatrix()));
    sys_count += 1;
    render();
    //for (let i = 0; i < elements.length; i++) { //create array of backbone sphere Meshes for base_selector
    //    backbones.push(elements[i].visual_object.children[elements[i].BACKBONE]);
    //}
    renderer.domElement.style.cursor = "auto";
    console.log("loadtime was", Date.now() - start)
}


function getNewConfig(mode) { //attempts to display next configuration; same as readDat() except does not make new sphere Meshes, etc. - maximize efficiency
    if (systems.length > 1) {
        alert("Only one file at a time can be read as a trajectory, sorry...");
        return;
    }
    for (let i = 0; i < systems.length; i++) { //for each system - does not actually work for multiple systems
        let system = systems[i];
        let num_nuc: number = system.system_length(); //gets # of nuc in system
        let lines
        if (mode == 1) {
            lines = extract_next_conf()
            conf_num += 1
        }
        if (mode == -1) {
            lines = extract_previous_conf()
            conf_num -= 1
        }
        if (lines == undefined) {
            alert("No more confs to load!");
            return;
        }

        let nuc_local_id = 0;
        let current_strand = systems[i].strands[0];
        //get the simulation box size
        let box = parseFloat(lines[1].split(" ")[3]);
        let time = parseInt(lines[0].split(" ")[2]);
        console.log(conf_num, 't =', time);
        // discard the header
        lines = lines.slice(3);

        for (let line_num = 0; line_num < num_nuc; line_num++) {
            if (lines[line_num] == "" || undefined) {
                alert("There's an empty line in the middle of your configuration!")
                break
            };
            let current_nucleotide = current_strand.elements[nuc_local_id];
            //get nucleotide information
            // consume a new line 
            let l = lines[line_num].split(" ");
            let x = parseFloat(l[0]),
                y = parseFloat(l[1]),
                z = parseFloat(l[2]);
            current_nucleotide.pos = new THREE.Vector3(x, y, z);
            current_nucleotide.calculateNewConfigPositions(x, y, z, l);

            if (current_nucleotide.neighbor5 == null || current_nucleotide.neighbor5.local_id < current_nucleotide.local_id) {
                //system.system_3objects.add(current_strand.strand_3objects); //add strand_3objects to system_3objects
                current_strand = system.strands[current_strand.strand_id]; //don't ask, its another artifact of strands being 1-indexed
                nuc_local_id = 0; //reset
            }
            else {
                nuc_local_id += 1;
            };
            //updatePos(i); //currently messes up next configuration - sets positions of system, strands, and visual objects to be located at their cms - messes up rotation sp recalculation and trajectory
        }
        //box by strand
        let dx, dy, dz;
        for (let j = 0; j < systems[i].strands.length; j++) { //for each strand in system
            // compute offset to bring strand in box
            let n = systems[i].strands[j].elements.length; //# of elements on strand
            let cms = new THREE.Vector3(0, 0, 0);
            for (let k = 0; k < n; k++) { //sum cms of each visual_object in strand; stored in children[3] = posObj Mesh 
                let bbint: number = systems[i].strands[j].elements[k].getCOM();
                cms.add(systems[i].strands[j].elements[k].visual_object.children[bbint].position);
            }
            //calculate cms
            let mul = 1.0 / n;
            cms.multiplyScalar(mul);
            //console.log(cms);
            dx = Math.round(cms.x / box) * box;
            dy = Math.round(cms.y / box) * box;
            dz = Math.round(cms.z / box) * box;

            //fix coordinates
            for (let k = 0; k < systems[i].strands[j].elements.length; k++) { //for each nucleotide in strand
                for (let l = 0; l < systems[i].strands[j].elements[k].visual_object.children.length; l++) { //for each Mesh in nucleotide's visual_object
                    let pos = systems[i].strands[j].elements[k].visual_object.children[l].position; //get Mesh position
                    //console.log(pos);
                    //calculate new positions by offset
                    pos.x = pos.x - dx;
                    pos.y = pos.y - dy;
                    pos.z = pos.z - dz;
                    systems[i].strands[j].elements[k].visual_object.children[l].position.set(pos.x, pos.y, pos.z); //set new positions
                    //console.log(systems[i].strands[j].elements[k].visual_object.children)
                    systems[i].strands[j].elements[k].visual_object.children[l].updateMatrix()
                }
            }
        }
        if (getActionModes().includes("Drag")) {
            drag();
        }
    }
    render();
}
