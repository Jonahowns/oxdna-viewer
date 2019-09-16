/// <reference path="./three/index.d.ts" />
// store rendering mode RNA  
let RNA_MODE = false; // By default we do DNA base spacing
// add base index visualistion
var elements = []; //contains references to all BasicElements
//initialize the space
var systems = [];
let sys_count = 0;
let strand_count = 0;
let nuc_count = 0;
//var selected_bases: number[] = [];
var selected_bases = new Set();
var backbones = [];
let lut, devs; //need for Lut coloring
let lutCols = [];
let lutColsVis = false;
let DNA = 0;
let RNA = 1;
let AA = 2;
var strands = 'children', monomers = 'children', objects = 'children';
render();
// elements store the information about position, orientation, ID
// Eventually there should be a way to pair them
// Everything is an Object3D, but only elements have anything to render
class BasicElement extends THREE.Group {
    constructor(global_id, parent) {
        super();
        //: THREE.Group; //contains 4 THREE.Mesh
        //BACKBONE: number = 0;
        //NUCLEOSIDE: number = 0;
        //BB_NS_CON: number = 1;
        this.COM = 0;
        //SP_CON: number = 3;
        this.element_type = -1;
        this.global_id = global_id;
        this.parent = parent;
    }
    ;
    calculatePositions(x, y, z, l) {
    }
    ;
    calculateNewConfigPositions(x, y, z, l) {
    }
    ;
    updateSP(num) {
        return new THREE.Object3D();
    }
    ;
    //abstract rotate(): void;
    toggle() {
    }
    ;
    strand_to_color(strandIndex) {
        return backbone_colors[(Math.abs(strandIndex) + this.parent.parent.system_id) % backbone_colors.length];
    }
    ;
    elem_to_color(type) {
        return new THREE.Color();
    }
    ;
    getDatFileOutput() {
        return "";
    }
    ;
    resetColor() {
    }
    ;
    set_position(new_pos) {
    }
    translate_position(amount) {
    }
    rotate(quat) {
    }
    //retrieve this element's values in a 3-parameter instance array
    //positions, scales, colors
    get_instance_parameter3(name) {
        let sys = this.parent.parent;
        let sid = this.global_id - sys.global_start_id;
        let x = sys[name][sid * 3];
        let y = sys[name][sid * 3 + 1];
        let z = sys[name][sid * 3 + 2];
        return new THREE.Vector3(x, y, z);
    }
    //retrieve this element's values in a 4-parameter instance array
    //only rotations right now
    get_instance_parameter4(name) {
        let sys = this.parent.parent;
        let sid = this.global_id - sys.global_start_id;
        let x = sys[name][sid * 4];
        let y = sys[name][sid * 4 + 1];
        let z = sys[name][sid * 4 + 2];
        let w = sys[name][sid * 4 + 3];
        return new THREE.Vector4(x, y, z, w);
    }
    set_instance_parameter(name, data) {
        let sys = this.parent.parent;
        let sid = this.global_id - sys.global_start_id;
        sys.fill_vec(name, data.length, sid, data);
    }
    toggle_visibility() {
        let sys = this.parent.parent;
        let sid = this.global_id - sys.global_start_id;
        let visibility = this.get_instance_parameter3('visibility');
        visibility.addScalar(-1);
        sys.fill_vec('visibility', 3, sid, [Math.abs(visibility.x), Math.abs(visibility.y), Math.abs(visibility.z)]);
    }
}
;
class Nucleotide extends BasicElement {
    constructor(global_id, parent) {
        super(global_id, parent);
    }
    ;
    calculatePositions(x, y, z, l) {
        let sys = this.parent.parent;
        let sid = this.global_id - sys.global_start_id;
        // extract axis vector a1 (backbone vector) and a3 (stacking vector) 
        let x_a1 = parseFloat(l[3]), y_a1 = parseFloat(l[4]), z_a1 = parseFloat(l[5]), x_a3 = parseFloat(l[6]), y_a3 = parseFloat(l[7]), z_a3 = parseFloat(l[8]);
        // according to base.py a2 is the cross of a1 and a3
        let [x_a2, y_a2, z_a2] = cross(x_a1, y_a1, z_a1, x_a3, y_a3, z_a3);
        // compute backbone position
        let x_bb = 0;
        let y_bb = 0;
        let z_bb = 0;
        let bbpos = this.calcBBPos(x, y, z, x_a1, y_a1, z_a1, x_a2, y_a2, z_a2, x_a3, y_a3, z_a3);
        x_bb = bbpos.x;
        y_bb = bbpos.y;
        z_bb = bbpos.z;
        // compute nucleoside cm
        let x_ns = x + 0.4 * x_a1, y_ns = y + 0.4 * y_a1, z_ns = z + 0.4 * z_a1;
        // compute nucleoside rotation
        let base_rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_a3, y_a3, z_a3));
        //compute connector position
        let x_con = (x_bb + x_ns) / 2, y_con = (y_bb + y_ns) / 2, z_con = (z_bb + z_ns) / 2;
        // compute connector rotation
        let rotation_con = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_con - x_ns, y_con - y_ns, z_con - z_ns).normalize());
        // compute sugar-phosphate positions/rotations, or set them all to 0 if there is no sugar-phosphate.
        let x_sp, y_sp, z_sp, sp_len, rotation_sp;
        if (this.neighbor3 != null && this.neighbor3.local_id < this.local_id) {
            x_sp = (x_bb + x_bb_last) / 2,
                y_sp = (y_bb + y_bb_last) / 2,
                z_sp = (z_bb + z_bb_last) / 2;
            sp_len = Math.sqrt(Math.pow(x_bb - x_bb_last, 2) + Math.pow(y_bb - y_bb_last, 2) + Math.pow(z_bb - z_bb_last, 2));
            rotation_sp = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_sp - x_bb, y_sp - y_bb, z_sp - z_bb).normalize());
        }
        else {
            x_sp = 0,
                y_sp = 0,
                z_sp = 0;
            sp_len = 0;
            rotation_sp = new THREE.Quaternion(0, 0, 0, 0);
        }
        //handle circular strands
        if (this.neighbor5 != null && this.neighbor5.local_id < this.local_id) {
            let tmpx_bb_last = sys.bb_offsets[this.neighbor5.global_id * 3], tmpy_bb_last = sys.bb_offsets[this.neighbor5.global_id * 3 + 1], tmpz_bb_last = sys.bb_offsets[this.neighbor5.global_id * 3 + 2];
            let tmpx_sp = (x_bb + tmpx_bb_last) / 2, tmpy_sp = (y_bb + tmpy_bb_last) / 2, tmpz_sp = (z_bb + tmpz_bb_last) / 2;
            let tmpsp_len = Math.sqrt(Math.pow(x_bb - tmpx_bb_last, 2) + Math.pow(y_bb - tmpy_bb_last, 2) + Math.pow(z_bb - tmpz_bb_last, 2));
            let tmprotation_sp = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(tmpx_sp - x_bb, tmpy_sp - y_bb, tmpz_sp - z_bb).normalize());
            sys.fill_vec('bbcon_offsets', 3, sid, [tmpx_sp, tmpy_sp, tmpz_sp]);
            sys.fill_vec('bbcon_rotation', 4, sid, [tmprotation_sp.w, tmprotation_sp.z, tmprotation_sp.y, tmprotation_sp.x]);
            sys.fill_vec('bbcon_scales', 3, sid, [1, tmpsp_len, 1]);
        }
        // determine the mesh color, either from a supplied colormap json or by the strand ID.
        var color;
        if (lutColsVis) {
            color = lutCols[i];
        }
        else {
            color = this.strand_to_color(this.parent.strand_id);
        }
        let idColor = new THREE.Color();
        idColor.setHex(this.global_id + 1); //has to be +1 or you can't grab nucleotide 0
        //fill the instance matrices with data
        this.name = sid + ""; //set name (string) to nucleotide's global id
        sys.fill_vec('cm_offsets', 3, sid, [x, y, z]);
        sys.fill_vec('bb_offsets', 3, sid, [x_bb, y_bb, z_bb]);
        sys.fill_vec('ns_offsets', 3, sid, [x_ns, y_ns, z_ns]);
        sys.fill_vec('ns_offsets', 3, sid, [x_ns, y_ns, z_ns]);
        sys.fill_vec('ns_rotation', 4, sid, [base_rotation.w, base_rotation.z, base_rotation.y, base_rotation.x]);
        sys.fill_vec('con_offsets', 3, sid, [x_con, y_con, z_con]);
        sys.fill_vec('con_rotation', 4, sid, [rotation_con.w, rotation_con.z, rotation_con.y, rotation_con.x]);
        sys.fill_vec('bbcon_offsets', 3, sid, [x_sp, y_sp, z_sp]);
        sys.fill_vec('bbcon_rotation', 4, sid, [rotation_sp.w, rotation_sp.z, rotation_sp.y, rotation_sp.x]);
        sys.fill_vec('bb_colors', 3, sid, [color.r, color.g, color.b]);
        sys.fill_vec('scales', 3, sid, [1, 1, 1]);
        sys.fill_vec('ns_scales', 3, sid, [0.7, 0.3, 0.7]);
        sys.fill_vec('con_scales', 3, sid, [1, this.bb_ns_distance, 1]);
        sys.fill_vec('bbcon_scales', 3, sid, [1, sp_len, 1]);
        sys.fill_vec('visibility', 3, sid, [1, 1, 1]);
        color = this.elem_to_color(this.type);
        sys.fill_vec('ns_colors', 3, sid, [color.r, color.g, color.b]);
        sys.fill_vec('bb_labels', 3, sid, [idColor.r, idColor.g, idColor.b]);
        // keep track of last backbone for sugar-phosphate positioning
        x_bb_last = x_bb;
        y_bb_last = y_bb;
        z_bb_last = z_bb;
    }
    ;
    translate_position(amount) {
        let sys = this.parent.parent;
        let id = (this.global_id - sys.global_start_id) * 3;
        sys.bb_offsets[id] += amount.x;
        sys.bb_offsets[id + 1] += amount.y;
        sys.bb_offsets[id + 2] += amount.z;
        sys.ns_offsets[id] += amount.x;
        sys.ns_offsets[id + 1] += amount.y;
        sys.ns_offsets[id + 2] += amount.z;
        sys.con_offsets[id] += amount.x;
        sys.con_offsets[id + 1] += amount.y;
        sys.con_offsets[id + 2] += amount.z;
        sys.bbcon_offsets[id] += amount.x;
        sys.bbcon_offsets[id + 1] += amount.y;
        sys.bbcon_offsets[id + 2] += amount.z;
        sys.cm_offsets[id] += amount.x;
        sys.cm_offsets[id + 1] += amount.y;
        sys.cm_offsets[id + 2] += amount.z;
    }
    calcBBPos(x, y, z, x_a1, y_a1, z_a1, x_a2, y_a2, z_a2, x_a3, y_a3, z_a3) {
        return new THREE.Vector3(x, y, z);
    }
    ;
    calculateNewConfigPositions(x, y, z, l) {
        let sys = this.parent.parent;
        let sid = this.global_id - sys.global_start_id;
        // extract axis vector a1 (backbone vector) and a3 (stacking vector) 
        let x_a1 = parseFloat(l[3]), y_a1 = parseFloat(l[4]), z_a1 = parseFloat(l[5]), x_a3 = parseFloat(l[6]), y_a3 = parseFloat(l[7]), z_a3 = parseFloat(l[8]);
        // according to base.py a2 is the cross of a1 and a3
        let [x_a2, y_a2, z_a2] = cross(x_a1, y_a1, z_a1, x_a3, y_a3, z_a3);
        // compute backbone cm
        let x_bb = 0;
        let y_bb = 0;
        let z_bb = 0;
        let bbpos = this.calcBBPos(x, y, z, x_a1, y_a1, z_a1, x_a2, y_a2, z_a2, x_a3, y_a3, z_a3);
        x_bb = bbpos.x;
        y_bb = bbpos.y;
        z_bb = bbpos.z;
        // compute nucleoside cm
        let x_ns = x + 0.4 * x_a1, y_ns = y + 0.4 * y_a1, z_ns = z + 0.4 * z_a1;
        //compute connector position
        let x_con = (x_bb + x_ns) / 2, y_con = (y_bb + y_ns) / 2, z_con = (z_bb + z_ns) / 2;
        //correctly display stacking interactions
        let base_rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_a3, y_a3, z_a3));
        // compute connector rotation
        let rotation_con = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_bb - x_ns, y_bb - y_ns, z_bb - z_ns).normalize());
        // compute sugar-phosphate positions/rotations, or set them all to 0 if there is no sugar-phosphate.
        let x_sp, y_sp, z_sp, sp_len, rotation_sp;
        if (this.neighbor3 != null && this.neighbor3.local_id < this.local_id) {
            x_sp = (x_bb + x_bb_last) / 2,
                y_sp = (y_bb + y_bb_last) / 2,
                z_sp = (z_bb + z_bb_last) / 2;
            sp_len = Math.sqrt(Math.pow(x_bb - x_bb_last, 2) + Math.pow(y_bb - y_bb_last, 2) + Math.pow(z_bb - z_bb_last, 2));
            rotation_sp = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_sp - x_bb, y_sp - y_bb, z_sp - z_bb).normalize());
        }
        else {
            x_sp = 0,
                y_sp = 0,
                z_sp = 0;
            sp_len = 0;
            rotation_sp = new THREE.Quaternion(0, 0, 0, 0);
        }
        if (this.neighbor5 != null && this.neighbor5.local_id < this.local_id) { //handle circular strands
            let tmpx_bb_last = sys.bb_offsets[this.neighbor5.global_id * 3], tmpy_bb_last = sys.bb_offsets[this.neighbor5.global_id * 3 + 1], tmpz_bb_last = sys.bb_offsets[this.neighbor5.global_id * 3 + 2];
            let tmpx_sp = (x_bb + tmpx_bb_last) / 2, tmpy_sp = (y_bb + tmpy_bb_last) / 2, tmpz_sp = (z_bb + tmpz_bb_last) / 2;
            let tmpsp_len = Math.sqrt(Math.pow(x_bb - tmpx_bb_last, 2) + Math.pow(y_bb - tmpy_bb_last, 2) + Math.pow(z_bb - tmpz_bb_last, 2));
            let tmprotation_sp = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(tmpx_sp - x_bb, tmpy_sp - y_bb, tmpz_sp - z_bb).normalize());
            sys.fill_vec('bbcon_offsets', 3, sid, [tmpx_sp, tmpy_sp, tmpz_sp]);
            sys.fill_vec('bbcon_rotation', 4, sid, [tmprotation_sp.w, tmprotation_sp.z, tmprotation_sp.y, tmprotation_sp.x]);
            sys.fill_vec('bbcon_scales', 3, sid, [1, tmpsp_len, 1]);
        }
        //update the relevant instancing matrices
        sys.fill_vec('cm_offsets', 3, sid, [x, y, z]);
        sys.fill_vec('bb_offsets', 3, sid, [x_bb, y_bb, z_bb]);
        sys.fill_vec('ns_offsets', 3, sid, [x_ns, y_ns, z_ns]);
        sys.fill_vec('ns_rotation', 4, sid, [base_rotation.w, base_rotation.z, base_rotation.y, base_rotation.x]);
        sys.fill_vec('con_offsets', 3, sid, [x_con, y_con, z_con]);
        sys.fill_vec('con_rotation', 4, sid, [rotation_con.w, rotation_con.z, rotation_con.y, rotation_con.x]);
        sys.fill_vec('bbcon_offsets', 3, sid, [x_sp, y_sp, z_sp]);
        sys.fill_vec('bbcon_rotation', 4, sid, [rotation_sp.w, rotation_sp.z, rotation_sp.y, rotation_sp.x]);
        sys.fill_vec('bbcon_scales', 3, sid, [1, sp_len, 1]);
        // keep track of last backbone for sugar-phosphate positioning
        x_bb_last = x_bb;
        y_bb_last = y_bb;
        z_bb_last = z_bb;
    }
    ;
    resetColor() {
        let sys = this.parent.parent;
        let sid = this.global_id - sys.global_start_id;
        //recalculate Mesh's proper coloring and set Mesh material on scene to proper material
        let color;
        if (lutColsVis) {
            color = lutCols[this.global_id];
        }
        else {
            color = this.strand_to_color(this.parent.strand_id);
        }
        sys.fill_vec('bb_colors', 3, sid, [color.r, color.g, color.b]);
    }
    toggle() {
        let sys = this.parent.parent;
        let sid = this.global_id - sys.global_start_id;
        // highlight/remove highlight the bases we've clicked 
        if (selected_bases.has(this)) { //if clicked nucleotide is already selected
            this.resetColor();
            selected_bases.delete(this); //"unselect" nucletide by setting value in selected_bases array at nucleotideID to 0
        }
        else {
            sys.fill_vec('bb_colors', 3, sid, [selection_color.r, selection_color.g, selection_color.b]);
            selected_bases.add(this); //"select" nucletide by adding it to the selected base list
        }
    }
    ;
    elem_to_color(elem) {
        elem = { "A": 0, "G": 1, "C": 2, "T": 3, "U": 3 }[elem];
        if (elem == undefined) {
            return grey;
        }
        return nucleoside_colors[elem];
    }
    ;
    getDatFileOutput() {
        let dat = "";
        let tempVec = this.get_instance_parameter3("cm_offsets"); //nucleotide's center of mass in world
        let x = tempVec.x;
        let y = tempVec.y;
        let z = tempVec.z;
        tempVec = this.get_instance_parameter3("bb_offsets");
        let x_bb = tempVec.x;
        let y_bb = tempVec.y;
        let z_bb = tempVec.z;
        tempVec = this.get_instance_parameter3("ns_offsets"); //nucleotide's nucleoside's world position
        let x_ns = tempVec.x;
        let y_ns = tempVec.y;
        let z_ns = tempVec.z;
        let x_a1;
        let y_a1;
        let z_a1;
        //calculate axis vector a1 (backbone vector) and a3 (stacking vector)
        x_a1 = (x_ns - x) / 0.4;
        y_a1 = (y_ns - y) / 0.4;
        z_a1 = (z_ns - z) / 0.4;
        let a3 = this.getA3(x_bb, y_bb, z_bb, x, y, z, x_a1, y_a1, z_a1);
        let x_a3 = a3.x;
        let y_a3 = a3.y;
        let z_a3 = a3.z;
        dat = x + " " + y + " " + z + " " + x_a1 + " " + y_a1 + " " + z_a1 + " " + x_a3 + " " + y_a3 +
            " " + z_a3 + " 0 0 0 0 0 0" + "\n"; //add all locations to dat file string
        return dat;
    }
    ;
    getA3(x_bb, y_bb, z_bb, x, y, z, x_a1, y_a1, z_a1) {
        return new THREE.Vector3();
    }
    ;
}
;
class DNANucleotide extends Nucleotide {
    constructor(global_id, parent) {
        super(global_id, parent);
        this.element_type = DNA;
        this.bb_ns_distance = 0.8147053;
    }
    ;
    calcBBPos(x, y, z, x_a1, y_a1, z_a1, x_a2, y_a2, z_a2, x_a3, y_a3, z_a3) {
        let x_bb = x - (0.34 * x_a1 + 0.3408 * x_a2), y_bb = y - (0.34 * y_a1 + 0.3408 * y_a2), z_bb = z - (0.34 * z_a1 + 0.3408 * z_a2);
        return new THREE.Vector3(x_bb, y_bb, z_bb);
    }
    ;
    getA3(x_bb, y_bb, z_bb, x, y, z, x_a1, y_a1, z_a1) {
        let x_a2;
        let y_a2;
        let z_a2;
        x_a2 = ((x_bb - x) + (0.34 * x_a1)) / (-0.3408);
        y_a2 = ((y_bb - y) + (0.34 * y_a1)) / (-0.3408);
        z_a2 = ((z_bb - z) + (0.34 * z_a1)) / (-0.3408);
        let Coeff = [[0, -(z_a1), y_a1], [-(z_a1), 0, x_a1], [-(y_a1), x_a1, 0]];
        let x_matrix = [[x_a2, -(z_a1), y_a1], [y_a2, 0, x_a1], [z_a2, x_a1, 0]];
        let y_matrix = [[0, x_a2, y_a1], [-(z_a1), y_a2, x_a1], [-(y_a1), z_a2, 0]];
        let z_matrix = [[0, -(z_a1), x_a2], [-(z_a1), 0, y_a2], [-(y_a1), x_a1, z_a2]];
        let a3 = divAndNeg(cross(x_a1, y_a1, z_a1, x_a2, y_a2, z_a2), dot(x_a1, y_a1, z_a1, x_a1, y_a1, z_a1));
        let x_a3 = a3[0];
        let y_a3 = a3[1];
        let z_a3 = a3[2];
        return new THREE.Vector3(x_a3, y_a3, z_a3);
    }
    ;
}
;
class RNANucleotide extends Nucleotide {
    constructor(global_id, parent) {
        super(global_id, parent);
        this.element_type = RNA;
        this.bb_ns_distance = 0.8246211;
    }
    ;
    calcBBPos(x, y, z, x_a1, y_a1, z_a1, x_a2, y_a2, z_a2, x_a3, y_a3, z_a3) {
        let x_bb = x - (0.4 * x_a1 + 0.2 * x_a3), y_bb = y - (0.4 * y_a1 + 0.2 * y_a3), z_bb = z - (0.4 * z_a1 + 0.2 * z_a3);
        return new THREE.Vector3(x_bb, y_bb, z_bb);
    }
    ;
    getA3(x_bb, y_bb, z_bb, x, y, z, x_a1, y_a1, z_a1) {
        let x_a3 = ((x_bb - x) + (0.4 * x_a1)) / (-0.2);
        let y_a3 = ((y_bb - y) + (0.4 * y_a1)) / (-0.2);
        let z_a3 = ((z_bb - z) + (0.4 * z_a1)) / (-0.2);
        return new THREE.Vector3(x_a3, y_a3, z_a3);
    }
    ;
}
;
class AminoAcid extends BasicElement {
    constructor(global_id, parent) {
        super(global_id, parent);
        this.element_type = AA;
    }
    ;
    elem_to_color(elem) {
        elem = { "R": 0, "H": 1, "K": 2, "D": 3, "E": 3, "S": 4, "T": 5, "N": 6, "Q": 7, "C": 8, "U": 9, "G": 10, "P": 11, "A": 12, "V": 13, "I": 14, "L": 15, "M": 16, "F": 17, "Y": 18, "W": 19 }[elem];
        if (elem == undefined)
            return grey;
        return nucleoside_colors[elem];
    }
    ;
    calculatePositions(x, y, z, l) {
        let sys = this.parent.parent;
        let sid = this.global_id - sys.global_start_id;
        // compute backbone positions/rotations, or set them all to 0 if there is no neighbor.
        let x_sp, y_sp, z_sp, sp_len, rotation_sp;
        if (this.neighbor3 != null && this.neighbor3.local_id < this.local_id) {
            x_sp = (x + x_bb_last) / 2,
                y_sp = (y + y_bb_last) / 2,
                z_sp = (z + z_bb_last) / 2;
            sp_len = Math.sqrt(Math.pow(x - x_bb_last, 2) + Math.pow(y - y_bb_last, 2) + Math.pow(z - z_bb_last, 2));
            rotation_sp = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_sp - x, y_sp - y, z_sp - z).normalize());
        }
        else {
            x_sp = 0,
                y_sp = 0,
                z_sp = 0;
            sp_len = 0;
            rotation_sp = new THREE.Quaternion(0, 0, 0, 0);
        }
        if (this.neighbor5 != null && this.neighbor5.local_id < this.local_id) { //handle circular strands
            let tmpx_bb_last = sys.bb_offsets[this.neighbor5.global_id * 3], tmpy_bb_last = sys.bb_offsets[this.neighbor5.global_id * 3 + 1], tmpz_bb_last = sys.bb_offsets[this.neighbor5.global_id * 3 + 2];
            let tmpx_sp = (x + tmpx_bb_last) / 2, tmpy_sp = (y + tmpy_bb_last) / 2, tmpz_sp = (z + tmpz_bb_last) / 2;
            let tmpsp_len = Math.sqrt(Math.pow(x - tmpx_bb_last, 2) + Math.pow(y - tmpy_bb_last, 2) + Math.pow(z - tmpz_bb_last, 2));
            let tmprotation_sp = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(tmpx_sp - x, tmpy_sp - y, tmpz_sp - z).normalize());
            sys.fill_vec('bbcon_offsets', 3, sid, [tmpx_sp, tmpy_sp, tmpz_sp]);
            sys.fill_vec('bbcon_rotation', 4, sid, [tmprotation_sp.w, tmprotation_sp.z, tmprotation_sp.y, tmprotation_sp.x]);
            sys.fill_vec('bbcon_scales', 3, sid, [1, tmpsp_len, 1]);
        }
        // determine the mesh color, either from a supplied colormap json or by the strand ID.
        var color;
        if (lutColsVis) {
            color = lutCols[i];
        }
        else {
            color = this.strand_to_color(this.parent.strand_id);
        }
        // fill in the instancing matrices
        this.name = sid + ""; //set name (string) to nucleotide's global id
        sys.fill_vec('cm_offsets', 3, sid, [x, y, z]);
        sys.fill_vec('bb_offsets', 3, sid, [0, 0, 0]);
        sys.fill_vec('bb_rotation', 4, sid, [0, 0, 0, 0]);
        sys.fill_vec('ns_offsets', 3, sid, [x, y, z]);
        sys.fill_vec('ns_rotation', 4, sid, [0, 0, 0, 0]);
        sys.fill_vec('con_offsets', 3, sid, [0, 0, 0]);
        sys.fill_vec('con_rotation', 4, sid, [0, 0, 0, 0]);
        sys.fill_vec('bbcon_offsets', 3, sid, [x_sp, y_sp, z_sp]);
        sys.fill_vec('bbcon_rotation', 4, sid, [rotation_sp.w, rotation_sp.z, rotation_sp.y, rotation_sp.x]);
        sys.fill_vec('scales', 3, sid, [0, 0, 0]);
        sys.fill_vec('ns_scales', 3, sid, [1, 1, 1]);
        sys.fill_vec('con_scales', 3, sid, [0, 0, 0]);
        sys.fill_vec('bbcon_scales', 3, sid, [1, sp_len, 1]);
        sys.fill_vec('bb_colors', 3, sid, [color.r, color.g, color.b]);
        color = this.elem_to_color(this.type);
        sys.fill_vec('ns_colors', 3, sid, [color.r, color.g, color.b]);
        // keep track of last backbone for sugar-phosphate positioning
        x_bb_last = x;
        y_bb_last = y;
        z_bb_last = z;
    }
    ;
    calculateNewConfigPositions(x, y, z, l) {
        let sys = this.parent.parent;
        let sid = this.global_id - sys.global_start_id;
        let x_sp, y_sp, z_sp, sp_len, rotation_sp;
        if (this.neighbor3 != null && this.neighbor3.local_id < this.local_id) {
            x_sp = (x + x_bb_last) / 2,
                y_sp = (y + y_bb_last) / 2,
                z_sp = (z + z_bb_last) / 2;
            sp_len = Math.sqrt(Math.pow(x - x_bb_last, 2) + Math.pow(y - y_bb_last, 2) + Math.pow(z - z_bb_last, 2));
            rotation_sp = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_sp - x, y_sp - y, z_sp - z).normalize());
        }
        else {
            x_sp = 0,
                y_sp = 0,
                z_sp = 0;
            sp_len = 0;
            rotation_sp = new THREE.Quaternion(0, 0, 0, 0);
        }
        if (this.neighbor5 != null && this.neighbor5.local_id < this.local_id) { //handle circular strands
            let tmpx_bb_last = sys.bb_offsets[this.neighbor5.global_id * 3], tmpy_bb_last = sys.bb_offsets[this.neighbor5.global_id * 3 + 1], tmpz_bb_last = sys.bb_offsets[this.neighbor5.global_id * 3 + 2];
            let tmpx_sp = (x + tmpx_bb_last) / 2, tmpy_sp = (y + tmpy_bb_last) / 2, tmpz_sp = (z + tmpz_bb_last) / 2;
            let tmpsp_len = Math.sqrt(Math.pow(x - tmpx_bb_last, 2) + Math.pow(y - tmpy_bb_last, 2) + Math.pow(z - tmpz_bb_last, 2));
            let tmprotation_sp = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(tmpx_sp - x, tmpy_sp - y, tmpz_sp - z).normalize());
            sys.fill_vec('bbcon_offsets', 3, sid, [tmpx_sp, tmpy_sp, tmpz_sp]);
            sys.fill_vec('bbcon_rotation', 4, sid, [tmprotation_sp.w, tmprotation_sp.z, tmprotation_sp.y, tmprotation_sp.x]);
            sys.fill_vec('bbcon_scales', 3, sid, [1, tmpsp_len, 1]);
        }
        sys.fill_vec('cm_offsets', 3, sid, [x, y, z]);
        sys.fill_vec('ns_offsets', 3, sid, [x, y, z]);
        sys.fill_vec('bbcon_offsets', 3, sid, [x_sp, y_sp, z_sp]);
        sys.fill_vec('bbcon_rotation', 4, sid, [rotation_sp.w, rotation_sp.z, rotation_sp.y, rotation_sp.x]);
        sys.fill_vec('bbcon_scales', 3, sid, [1, sp_len, 1]);
        x_bb_last = x;
        y_bb_last = y;
        z_bb_last = z;
    }
    ;
    resetColor() {
        let sys = this.parent.parent;
        let sid = this.global_id - sys.global_start_id;
        //recalculate Mesh's proper coloring and set Mesh material on scene to proper material
        let color;
        if (lutColsVis) {
            color = lutCols[this.global_id];
        }
        else {
            color = this.strand_to_color(this.parent.strand_id);
        }
        sys.fill_vec('bb_colors', 3, sid, [color.r, color.g, color.b]);
        sys.fill_vec('ns_colors', 3, sid, [color.r, color.g, color.b]);
    }
    ;
    toggle() {
        let sys = this.parent.parent;
        let sid = this.global_id - sys.global_start_id;
        if (selected_bases.has(this)) { //if clicked nucleotide is already selected
            this.resetColor();
            selected_bases.delete(this); //"unselect" nucletide by setting value in selected_bases array at nucleotideID to 0
        }
        else {
            sys.fill_vec('bb_colors', 3, sid, [selection_color.r, selection_color.g, selection_color.b]);
            sys.fill_vec('ns_colors', 3, sid, [selection_color.r, selection_color.g, selection_color.b]);
            selected_bases.add(this); //"select" nucletide by adding it to the selected base list
        }
        //selList.push(nucleotideID);
        selected_bases.add(this); //"select" nucletide by setting value in selected_bases array at nucleotideID to 1
    }
    ;
    getDatFileOutput() {
        let dat = "";
        let tempVec = this.get_instance_parameter3("cm_offsets");
        let x = tempVec.x;
        let y = tempVec.y;
        let z = tempVec.z;
        dat = x + " " + y + " " + z + "1.0 1.0 0.0 0.0 0.0 -1.0 0.0 0.0 0.0 0.0 0.0 0.0" + "\n"; //add all locations to dat file string
        return dat;
    }
    ;
}
;
// strands are made up of elements
// strands have an ID within the system
class Strand extends THREE.Group {
    constructor(id, parent) {
        super();
        this.strand_id = id;
        this.parent = parent;
    }
    ;
    add_basicElement(elem) {
        this[monomers].push(elem);
        elem.parent = this;
    }
    ;
    create_basicElement(global_id) {
        return new BasicElement(global_id, this);
    }
    remove_basicElement(to_remove) {
        for (let i = 0; i < this[monomers].length; i++) {
            let n = this[monomers][i];
            if (n.global_id == to_remove) { //changed from local to global id
                scene.remove(n);
                n = null;
            }
        }
    }
    ;
    exclude_Elements(elements) {
        // detach from parent
        elements.forEach((e) => {
            e.parent = null;
            this.remove(e);
        });
        // create a new list of strand elements  
        let filtered = this[monomers].filter((v, i, arr) => {
            return !elements.includes(v);
        });
        this[monomers] = filtered;
    }
    get_com() {
        let com = new THREE.Vector3(0, 0, 0);
        for (let i = (this[monomers][0].global_id - this.parent.global_start_id) * 3; i <= (this[monomers][this[monomers].length - 1].global_id - this.parent.global_start_id) * 3; i += 3) {
            com.add(new THREE.Vector3(this.parent.cm_offsets[i], this.parent.cm_offsets[i + 1], this.parent.cm_offsets[i + 2]));
        }
        return (com.multiplyScalar(1 / this[monomers].length));
    }
    translate_strand(amount) {
    }
}
;
class NucleicAcidStrand extends Strand {
    constructor(id, parent) {
        super(id, parent);
    }
    ;
    create_basicElement(global_id) {
        if (RNA_MODE)
            return new RNANucleotide(global_id, this);
        else
            return new DNANucleotide(global_id, this);
    }
    ;
    translate_strand(amount) {
        let s = this.parent;
        for (let i = (this[monomers][0].global_id - this.parent.global_start_id) * 3; i <= (this[monomers][this[monomers].length - 1].global_id - this.parent.global_start_id) * 3; i += 3) {
            s.bb_offsets[i] += amount.x;
            s.bb_offsets[i + 1] += amount.y;
            s.bb_offsets[i + 2] += amount.z;
            s.ns_offsets[i] += amount.x;
            s.ns_offsets[i + 1] += amount.y;
            s.ns_offsets[i + 2] += amount.z;
            s.con_offsets[i] += amount.x;
            s.con_offsets[i + 1] += amount.y;
            s.con_offsets[i + 2] += amount.z;
            s.bbcon_offsets[i] += amount.x;
            s.bbcon_offsets[i + 1] += amount.y;
            s.bbcon_offsets[i + 2] += amount.z;
            s.cm_offsets[i] += amount.x;
            s.cm_offsets[i + 1] += amount.y;
            s.cm_offsets[i + 2] += amount.z;
        }
        s.backbone.geometry["attributes"].instanceOffset.needsUpdate = true;
        s.nucleoside.geometry["attributes"].instanceOffset.needsUpdate = true;
        s.connector.geometry["attributes"].instanceOffset.needsUpdate = true;
        s.bbconnector.geometry["attributes"].instanceOffset.needsUpdate = true;
        s.dummy_backbone.geometry["attributes"].instanceOffset.needsUpdate = true;
    }
}
class Peptide extends Strand {
    constructor(id, parent) {
        super(id, parent);
    }
    ;
    create_basicElement(global_id) {
        return new AminoAcid(global_id, this);
    }
    translate_strand(amount) {
        let s = this.parent;
        for (let i = (this.children[0].global_id - this.parent.global_start_id) * 3; i < (this[monomers][this[monomers].length - 1].global_id - this.parent.global_start_id) * 3; i += 3) {
            s.ns_offsets[i] += amount.x;
            s.ns_offsets[i + 1] += amount.y;
            s.ns_offsets[i + 2] += amount.z;
            s.bbcon_offsets[i] += amount.x;
            s.bbcon_offsets[i + 1] += amount.y;
            s.bbcon_offsets[i + 2] += amount.z;
            s.cm_offsets[i] += amount.x;
            s.cm_offsets[i + 1] += amount.y;
            s.cm_offsets[i + 2] += amount.z;
        }
        s.nucleoside.geometry["attributes"].instanceOffset.needsUpdate = true;
        s.bbconnector.geometry["attributes"].instanceOffset.needsUpdate = true;
        s.dummy_backbone.geometry["attributes"].instanceOffset.needsUpdate = true;
    }
}
// systems are made of strands
// systems can CRUD
class System extends THREE.Group {
    constructor(id, start_id) {
        super();
        this.system_id = id;
        this.global_start_id = start_id;
    }
    ;
    system_length() {
        let count = 0;
        for (let i = 0; i < this[strands].length; i++) {
            count += this[strands][i][monomers].length;
        }
        return count;
    }
    ;
    create_Strand(str_id) {
        if (str_id < 0)
            return new Peptide(str_id, this);
        else
            return new NucleicAcidStrand(str_id, this);
    }
    ;
    add_strand(strand) {
        this[strands].push(strand);
        strand.parent = this;
    }
    ;
    remove_strand(to_remove) {
        for (let i = 0; i < this[strands].length; i++) {
            let s = this[strands][i];
            if (s.strand_id == to_remove) {
                this.remove(s);
                for (let j = 0; j < s[monomers].length; j++) {
                    s.remove(s[monomers][j]);
                    s.remove_basicElement(j);
                }
                scene.remove(s);
                s = null;
            }
            ;
            render();
        }
    }
    ;
    //computes the center of mass of the system
    get_com() {
        let com = new THREE.Vector3(0, 0, 0);
        for (let i = 0; i < this.INSTANCES * 3; i += 3) {
            com.add(new THREE.Vector3(this.cm_offsets[i], this.cm_offsets[i + 1], this.cm_offsets[i + 2]));
        }
        return (com.multiplyScalar(1 / this.INSTANCES));
    }
    //This is needed to handle strands that have experienced fix_diffusion.  Don't use it.
    strand_unweighted_com() {
        let com = new THREE.Vector3(0, 0, 0);
        let count = 0;
        this[strands].forEach((s) => {
            com.add(s.get_com());
            count += 1;
        });
        return (com.multiplyScalar(1 / count));
    }
    setDatFile(dat_file) {
        this.dat_file = dat_file;
    }
    translate_system(amount) {
        for (let i = 0; i < this.INSTANCES * 3; i += 3) {
            this.bb_offsets[i] += amount.x;
            this.bb_offsets[i + 1] += amount.y;
            this.bb_offsets[i + 2] += amount.z;
            this.ns_offsets[i] += amount.x;
            this.ns_offsets[i + 1] += amount.y;
            this.ns_offsets[i + 2] += amount.z;
            this.con_offsets[i] += amount.x;
            this.con_offsets[i + 1] += amount.y;
            this.con_offsets[i + 2] += amount.z;
            this.bbcon_offsets[i] += amount.x;
            this.bbcon_offsets[i + 1] += amount.y;
            this.bbcon_offsets[i + 2] += amount.z;
            this.cm_offsets[i] += amount.x;
            this.cm_offsets[i + 1] += amount.y;
            this.cm_offsets[i + 2] += amount.z;
        }
        this.backbone.geometry["attributes"].instanceOffset.needsUpdate = true;
        this.nucleoside.geometry["attributes"].instanceOffset.needsUpdate = true;
        this.connector.geometry["attributes"].instanceOffset.needsUpdate = true;
        this.bbconnector.geometry["attributes"].instanceOffset.needsUpdate = true;
        this.dummy_backbone.geometry["attributes"].instanceOffset.needsUpdate = true;
        render();
    }
    fill_vec(vec_name, unit_size, pos, vals) {
        for (i = 0; i < unit_size; i++) {
            this[vec_name][pos * unit_size + i] = vals[i];
        }
    }
}
;
function nextConfig() {
    if (next_reader.readyState == 1) { //0: nothing loaded 1: working 2: done
        return;
    }
    getNewConfig(1);
}
function previousConfig() {
    if (previous_previous_reader.readyState == 1) {
        return;
    }
    getNewConfig(-1);
}
document.addEventListener("keydown", function (event) {
    switch (event.key) {
        case 'n':
            nextConfig();
            break;
        case 'b':
            previousConfig();
            break;
    }
}, true);
function toggleVideoOptions() {
    let opt = document.getElementById("videoOptions");
    opt.hidden = !opt.hidden;
}
function toggleColorOptions() {
    let opt = document.getElementById("colorOptions");
    opt.hidden = !opt.hidden;
    colorOptions();
}
function colorOptions() {
    let opt = document.getElementById("colorOptions");
    if (!opt.hidden) {
        opt.innerHTML = ""; //Clear content
        let addButton = document.createElement('button');
        addButton.innerText = "Add Color";
        // Append new color to the end of the color list and reset colors
        addButton.onclick = function () {
            backbone_colors.push(new THREE.Color(0x156289));
            let index = 0;
            colorOptions();
        };
        //modifies the backbone_colors array
        for (let i = 0; i < backbone_colors.length; i++) {
            let m = backbone_colors[i];
            let c = document.createElement('input');
            c.type = 'color';
            c.value = "#" + m.getHexString();
            c.onchange = function () {
                backbone_colors[i] = new THREE.Color(c.value);
                colorOptions();
            };
            //deletes color on right click
            c.oncontextmenu = function (event) {
                event.preventDefault();
                backbone_colors.splice(i, 1);
                colorOptions();
                return false;
            };
            opt.appendChild(c);
        }
        opt.appendChild(addButton);
        let index = 0;
        //actually update things in the scene
        for (; index < elements.length; index++) {
            if (!selected_bases.has(elements[index]))
                elements[index].resetColor();
        }
        for (let i = 0; i < systems.length; i++) {
            systems[i].backbone.geometry["attributes"].instanceColor.needsUpdate = true;
            systems[i].connector.geometry["attributes"].instanceColor.needsUpdate = true;
            systems[i].bbconnector.geometry["attributes"].instanceColor.needsUpdate = true;
        }
        render();
    }
}
function createVideo() {
    // Get canvas
    let canvas = document.getElementById("threeCanvas");
    // Get options:
    let format = document.querySelector('input[name="videoFormat"]:checked').value;
    let framerate = document.getElementById("videoFramerate").value;
    let videoType = document.getElementById("videoType");
    // Set up movie capturer
    const capturer = new CCapture({
        format: format,
        framerate: framerate,
        name: videoType.value,
        verbose: true,
        display: true,
        workersPath: 'ts/lib/'
    });
    let button = document.getElementById("videoStartStop");
    button.innerText = "Stop";
    button.onclick = function () {
        capturer.stop();
        capturer.save();
    };
    try {
        switch (videoType.value) {
            case "trajectory":
                createTrajectoryVideo(canvas, capturer);
                break;
            case "lemniscate":
                createLemniscateVideo(canvas, capturer, framerate);
                break;
        }
    }
    catch (e) {
        alert("Failed to capture video: \n" + e);
        capturer.stop();
    }
}
function createTrajectoryVideo(canvas, capturer) {
    // Listen for configuration loaded events
    function _load(e) {
        e.preventDefault(); // cancel default actions
        capturer.capture(canvas);
        nextConfig();
    }
    // Listen for last configuration event
    function _done(e) {
        document.removeEventListener('nextConfigLoaded', _load);
        document.removeEventListener('finalConfig', _done);
        capturer.stop();
        capturer.save();
        button.innerText = "Start";
        button.onclick = createVideo;
        return;
    }
    // Overload stop button so that we don't forget to remove listeners
    let button = document.getElementById("videoStartStop");
    button.onclick = _done;
    document.addEventListener('nextConfigLoaded', _load);
    document.addEventListener('finalConfig', _done);
    // Start capturing
    capturer.start();
    nextConfig();
}
function createLemniscateVideo(canvas, capturer, framerate) {
    // Setup timing
    let duration = 10; //Seconds
    let tMax = 2 * Math.PI;
    let nFrames = duration * framerate;
    let dt = tMax / nFrames;
    // Preserve camera distance from origin:
    let d = Origin.distanceTo(camera.position);
    capturer.start();
    // Overload stop button so that we don't forget to remove listeners
    let button = document.getElementById("videoStartStop");
    button.onclick = function () { tMax = 0; };
    // Move camera and capture frames
    // This is not a for-loop since we need to use
    // requestAnimationFrame recursively.
    let t = 0;
    var animate = function () {
        if (t >= tMax) {
            capturer.stop();
            capturer.save();
            button.innerText = "Start";
            button.onclick = createVideo;
            return;
        }
        requestAnimationFrame(animate);
        camera.position.set(d * Math.cos(t), d * Math.sin(t) * Math.cos(t), d * Math.sqrt(Math.pow(Math.sin(t), 4)));
        camera.lookAt(Origin);
        t += dt;
        render();
        capturer.capture(canvas);
    };
    animate();
}
function toggleLut(chkBox) {
    if (lutCols.length > 0) { //lutCols stores each nucleotide's color (determined by flexibility)
        if (lutColsVis) { //if "Display Alternate Colors" checkbox selected (currently displaying coloring) - does not actually get checkbox value; at onload of webpage is false and every time checkbox is changed, it switches boolean
            lutColsVis = false; //now flexibility coloring is not being displayed and checkbox is not selected
            for (let i = 0; i < elements.length; i++) { //for all elements in all systems - does not work for more than one system
                if (!selected_bases.has(elements[i]))
                    elements[i].resetColor();
            }
        }
        else {
            for (let i = 0; i < elements.length; i++) { //for each nucleotide in all systems - does not work for multiple systems yet
                let tmeshlamb = new THREE.MeshLambertMaterial({
                    color: lutCols[i],
                    side: THREE.DoubleSide
                });
                for (let j = 0; j < elements[i][objects].length; j++) { //for each Mesh in each nucleotide's 
                    if (j != 3) { //for all except cms posObj Mesh
                        let tmesh = elements[i][objects][j];
                        tmesh.material = tmeshlamb;
                    }
                }
            }
            lutColsVis = true; //now flexibility coloring is being displayed and checkbox is selected
        }
        render();
    }
    else {
        alert("Please drag and drop the corresponding .json file.");
        chkBox.checked = false;
    }
}
function toggleBackground() {
    if (scene.background == WHITE) {
        scene.background = BLACK;
        render();
    }
    else {
        scene.background = WHITE;
        render();
    }
}
function toggleFog(near, far) {
    if (scene.fog == null) {
        scene.fog = new THREE.Fog(scene.background, near, far);
    }
    else {
        scene.fog = null;
    }
    render();
}
function cross(a1, a2, a3, b1, b2, b3) {
    return [a2 * b3 - a3 * b2,
        a3 * b1 - a1 * b3,
        a1 * b2 - a2 * b1];
}
//changes resolution on the nucleotide visual objects
/*function setResolution(resolution: number) {
    //change mesh_setup with the given resolution
    backbone_geometry = new THREE.SphereBufferGeometry(.2, resolution, resolution);
    nucleoside_geometry = new THREE.SphereBufferGeometry(.3, resolution, resolution).applyMatrix(
        new THREE.Matrix4().makeScale(0.7, 0.3, 0.7));
    connector_geometry = new THREE.CylinderBufferGeometry(.1, .1, 1, Math.max(2, resolution));

    //update all elements and hide some meshes if resolution is low enough
    for (let i = 0; i < elements.length; i++) {
        let nuc_group: THREE.Mesh[] = <THREE.Mesh[]>elements[i][objects];

        nuc_group[elements[i].BACKBONE].visible = resolution > 1;
        nuc_group[elements[i].BACKBONE].geometry = backbone_geometry;

        nuc_group[elements[i].NUCLEOSIDE].visible = resolution > 1;
        nuc_group[elements[i].NUCLEOSIDE].geometry = nucleoside_geometry;

        if (nuc_group[elements[i].BB_NS_CON]) {
            nuc_group[elements[i].BB_NS_CON].geometry = connector_geometry;
            nuc_group[elements[i].BB_NS_CON].visible = resolution > 1;
        }
        if (nuc_group[elements[i].SP_CON]) {
            nuc_group[elements[i].SP_CON].geometry = connector_geometry;
        }
    }
    render();
}*/
function toggleSideNav(button) {
    let hidden = "show";
    let visible = "hide";
    let tabcontent = document.getElementsByClassName("tabcontent");
    if (button.innerText == hidden) {
        tabcontent[0].style.display = "block";
        button.innerHTML = visible;
    }
    else {
        for (let i = 0; i < tabcontent.length; i++) {
            tabcontent[i].style.display = "none";
        }
        button.innerHTML = hidden;
    }
}
//strand delete testcode
document.addEventListener("keypress", event => {
    if (event.keyCode === 100) { //if d is pressed, delete first system's first strand
        systems[0].remove_strand(1);
        render();
    }
});
