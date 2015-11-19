import fs from "fs";
import path from "path";
import parseSnapshotStream from "./parseSnapshotStream";

/**
 * An implementation of working directly with snapshot data, not meant for dev consumption.
 * This implementation uses Synchronous file APIs
 */
export default class SplitSnapshotProvider {
	/**
	 * @param {Object} snapshot_info Meta information required for understanding a snapshot
	 * @param {Buffer} node_buffer
	 * @param {Buffer} edge_buffer
	 * @param {Buffer} string_indices_buffer
	 * @param {Buffer} string_buffer
	 */
  constructor(
    snapshot_info,
    node_buffer,
    edge_buffer,
    string_indices_buffer,
    string_buffer
  ) {
    const snapshot = snapshot_info;
    /**
     * @private
     */
    this.snapshot = snapshot;
		
    /**
     * @private
     */
    this.node_fields_length = snapshot.meta.node_fields.length;
    /**
     * @private
     */
	this.node_arr_length = snapshot.node_count * this.node_fields_length;
    // append edge_buffer index to get 1st edge
    /**
     * @private
     */
	this.node_struct_size = this.node_fields_length * 4 + 4;
    /**
     * @private
     */
    this.node_buffer = node_buffer;
	if (this.node_buffer.length !== this.node_struct_size * snapshot.node_count) {
		throw new Error('nodes buffer does not match the expected size (either number of nodes is incorrect, or structure is)');
	}

    /**
     * @private
     */
	this.edge_fields_length = snapshot.meta.edge_fields.length;
    /**
     * @private
     */
	this.edge_arr_length = snapshot.edge_count * this.edge_fields_length;
    // prepend node_buffer index to get node
    /**
     * @private
     */
	this.edge_struct_size = snapshot.meta.edge_fields.length * 4 + 4;
    /**
     * @private
     */
    this.edge_buffer = edge_buffer;
	if (this.edge_buffer.length !== this.edge_struct_size * snapshot.edge_count) {
		throw new Error('edges buffer does not match the expected size (either number of edges is incorrect, or structure is)')
	}
    
    /**
     * @private
     */
    this.string_indices_buffer = string_indices_buffer;
    /**
     * @private
     */
    this.strings_buffer = string_buffer;
    
    /**
     * @private
     */
	this.string_index_struct_size = 4 + 4;
  }


  /**
   * Get total number of Nodes
   * @return {number}
   */
  getNodeArraySize() {
    return this.node_arr_length;
  }


  /**
   * Get the buffer for a Node at the specified index
   * @param {number} index
   * @return {Buffer}
   */
  getNodeBuffer(index) {
    let n = index / this.node_fields_length;
    if (n !== (n | 0)) {
      throw new RangeError('index is not on a Node boundary');
    }
    let offset = n * this.node_struct_size;
    return this.node_buffer.slice(
      offset,
      offset + this.node_struct_size
    );
  }


  /**
   * Get total number of Edges
   * @return {number}
   */
  getEdgeArraySize() {
    return this.edge_arr_length;
  }


  /**
   * Get the buffer for an Edge at the specified index
   * @param {number} index
   * @return {Buffer}
   */
  getEdgeBuffer(index) {
    let n = index / this.edge_fields_length;
    if (n !== (n | 0)) {
      throw new RangeError('index is not on a Edge boundary');
    }
    let offset = n * this.edge_struct_size;
    return this.edge_buffer.slice(
      offset,
      offset + this.edge_struct_size
    );
  }
  
  getTraceBufferFrame(index) {
	  
  }
  
  getTraceLocation(index) {
	  
  }


  /**
   * Gets a string at the specified index.
   * @param {number} index Index of the string we wish to get.
   * @return {string} 
   */
  getString(index) {
    const index_offset = index * this.string_index_struct_size;
    const chunk = this.string_indices_buffer.slice(
      index_offset,
      index_offset + this.string_index_struct_size
    );
    const offset = chunk.readUInt32BE(0);
    const length = chunk.readUInt32BE(4);
    return this.strings_buffer.slice(
      offset,
      offset + length
    ).toString();
  }

  /**
	* @return {Object} Metadata from the snapshot data required to find Node and Field structure.
	*/
  getMeta() {
    return this.snapshot.meta;
  }
	
  /**
   * Convenience method for saving snapshot data in a faster loading format to a directory
   * @param {string} outdir Path of the directory to save to
   * @param {function(err: *)} callback Callback notified when there is an error or completion
   * @return {undefined}
   */
  writeToDirectory(outdir, callback) {
		const meta_file = path.join(outdir, 'snapshot.json');
		const nodes_file = path.join(outdir, 'nodes');
		const edges_file = path.join(outdir, 'edges');
		const strings_file = path.join(outdir, 'strings');
		const string_indices_file = path.join(outdir, 'string_indices');
		
		let todo = 5;
		function done(e) {
			todo--;
			if (todo < 0) {
				return;
			}
			if (e) {
				callback(e);
				todo = 0;
			}
			else if (todo === 0) {
				callback(null);
			}
		}
		
		fs.writeFile(meta_file, this.snapshot, done);
		fs.writeFile(nodes_file, this.node_buffer, done);
		fs.writeFile(edges_file, this.edge_buffer, done);
		fs.writeFile(strings_file, this.strings_buffer, done);
		fs.writeFile(string_indices_file, this.string_indices_buffer, done);
	}
	
  
	
  /**
   * Convenience method for loading snapshot data from a directory
   * @param {string} outdir Path of the directory to load
   * @param {function(err: *, provider: SplitSnapshotProvider)} callback Callback notified when there is an error or completion
   * @return {undefined}
   */
	static fromDirectory(outdir, callback) {
		const meta_file = path.join(outdir, 'snapshot.json');
		const nodes_file = path.join(outdir, 'nodes');
		const edges_file = path.join(outdir, 'edges');
		const strings_file = path.join(outdir, 'strings');
		const string_indices_file = path.join(outdir, 'string_indices');
		
		let todo = 5;
		let snapshot_info;
		let nodes_buffer;
		let edges_buffer;
		let strings_buffer;
		let string_indices_buffer;
		function done(e) {
			todo--;
			if (todo < 0) {
				return;
			}
			if (e) {
				callback(e);
				todo = 0;
			}
			else if (todo === 0) {
				callback(null, new SplitSnapshotProvider(
					snapshot_info,
					nodes_buffer,
					edges_buffer,
					string_indices_buffer,
					strings_buffer
				));
			}
		}
		fs.readFile(meta_file, (e,b) => {
			if (e) {
				done(e);
				return;
			}
			try {
				snapshot_info = JSON.parse(String(b));
				done();
			}
			catch (e) {
				done(e);
			}
		});
		fs.readFile(nodes_file, (e,b) => {
			if (e) {
				done(e);
				return;
			}
			nodes_buffer = b;
			done();
		});
		fs.readFile(edges_file, (e,b) => {
			if (e) {
				done(e);
				return;
			}
			edges_buffer = b;
			done();
		});
		fs.readFile(strings_file, (e,b) => {
			if (e) {
				done(e);
				return;
			}
			strings_buffer = b;
			done();
		});
		fs.readFile(string_indices_file, (e,b) => {
			if (e) {
				done(e);
				return;
			}
			string_indices_buffer = b;
			done();
		});
	}
  
  
  /**
   * Convenience method for loading snapshot data from a stream
   * @param {Stream} stream Path of the directory to load
   * @param {function(err: *, provider: SplitSnapshotProvider)} callback Callback notified when there is an error or completion
   * @return {undefined}
   */
	static fromStream(stream, callback) {
		// track this to attach to nodes
		let edge_offset = 0;
		let node_offset = -1;
		
		let edge_count_field_offset = 0;
		
		let snapshot_info = null;
		let nodes_buffer_index = 0;
		let nodes_buffer = null;
		let edges_buffer_index = 0;
		let edges_buffer = null;
		let strings_buffer_length = 0;
		let strings_buffer = null;
		let strings_indices_buffer_length = 0;
		let strings_indices_buffer = null;
		
		let node_struct_size = 0;
		
		stream.pipe(parseSnapshotStream({
			onsnapshot_info(snapshot) {
				edge_count_field_offset = snapshot.meta.node_fields.indexOf('edge_count') * 4;
				snapshot_info = snapshot;
				const node_fields_length = snapshot.meta.node_fields.length;
				// append edge_buffer index to get 1st edge
				node_struct_size = node_fields_length * 4 + 4;
				nodes_buffer = new Buffer(node_struct_size * snapshot.node_count);
			
				// prepend node_buffer index to get node
				const edge_struct_size = snapshot.meta.edge_fields.length * 4 + 4;
				edges_buffer = new Buffer(edge_struct_size * snapshot.edge_count);
				
				strings_indices_buffer = new Buffer(4 * 1024);
				strings_buffer = new Buffer(4 * 1024);
			},
			onnode(buffer) {
				if (buffer == null) {
					edge_offset = 0;
					return;
				}
				buffer.copy(nodes_buffer, nodes_buffer_index);
				nodes_buffer_index += buffer.length;
				nodes_buffer.writeUInt32BE(edge_offset, nodes_buffer_index);
				nodes_buffer_index += 4;
				const edge_count = buffer.readUInt32BE(edge_count_field_offset);
				edge_offset += edge_count;
			},
			onedge(buffer) {
				if (buffer == null) {
					return;
				}
				buffer.copy(edges_buffer, edges_buffer_index);
				edges_buffer_index += buffer.length;
				if (edge_offset == 0) {
					node_offset++;
					edge_offset = nodes_buffer.readUInt32BE(node_struct_size * node_offset + edge_count_field_offset);
				}
				else {
					edge_offset--;
				}
				edges_buffer.writeUInt32BE(node_offset * node_struct_size, edges_buffer_index);
				edges_buffer_index += 4;
			},
			onstring(str) {
				if (str == null) {
					strings_indices_buffer = strings_indices_buffer.slice(0, strings_indices_buffer_length);
					strings_buffer = strings_buffer.slice(0, strings_buffer_length);
					return;
				}
				let str_buf = new Buffer(str, 'utf8');
				let str_buf_length = str_buf.length;
				
				if (strings_indices_buffer.length - strings_indices_buffer_length < 8) {
					strings_indices_buffer = Buffer.concat([strings_indices_buffer, new Buffer(4096)]);
				}
				strings_indices_buffer.writeUInt32BE(strings_buffer_length, strings_indices_buffer_length);
				strings_indices_buffer_length += 4;
				strings_indices_buffer.writeUInt32BE(str_buf_length, strings_indices_buffer_length);
				strings_indices_buffer_length += 4;
				
				if (strings_buffer.length - strings_buffer_length < str_buf_length) {
					strings_buffer = Buffer.concat([strings_buffer, new Buffer(4096)]);
				}
				str_buf.copy(strings_buffer, strings_buffer_length);
				strings_buffer_length += str_buf_length;
			}
		}))
		.on('error', e=>callback(e))
		.on('end', ()=>{
			callback(null, new SplitSnapshotProvider(snapshot_info, nodes_buffer, edges_buffer, strings_indices_buffer, strings_buffer));
		});
	}
}