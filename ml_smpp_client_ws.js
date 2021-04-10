//
// Copyright (c) 2021 Melrose Labs Ltd - https://melroselabs.com
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

var smppSocket;
var smppSeqNoOut = 1;
var stateBound = false;

function showState() {
	  $('#connect').prop('disabled', stateBound);
	  $('#disconnect').prop('disabled', !stateBound);
	  $('#submitsm').prop('disabled', !stateBound);
	  $('#enquirelink').prop('disabled', !stateBound);
	  $('#statusbound').text(stateBound?"Connected":"Disconnected");
	  
	  if (stateBound == false) $("#accountDetailsPane").collapse("show");
}

$(document).ready(function () {
	showState();
}
);

function getString(view,i) {
	var str = "";
	
	while (true) {
		var ch = view.getUint8(i++,false);
		if (ch == 0) break;
		str += String.fromCharCode(ch);
	}
	return str;
}

function dv(str) {
	return "<code>"+str+"</code>";
}

function logTLVs(view,i,command_length) {

	while (i!=command_length) {
	  let tag  = view.getUint16(0*2+i,false);
	  let len  = view.getUint16(1*2+i,false);
	  
	  i+=4;
	  
	  var str = "",str_b = "";
	  for(var a=0;a<len;a++) {
	  	str += pad(view.getUint8(i+a,false).toString(16),2)+" ";
	  	
	  	let v = view.getUint8(i+a,false);
	  	switch(v) {
		  	case 0: str_b += ' <kbd>00</kbd>'; break
		  	case 32: str_b += ' <kbd>SP</kbd>'; break;
		  	default:
		  		if ((v>32)&&(v<128)) str_b += " <code>"+String.fromCharCode(v)+"</code>";
		  		else {
		  			str_b += " <kbd>";
		  			str_b += pad(view.getUint8(i+a,false).toString(16),2);
		  			str_b += "</kbd>";
		  		}
	  	}
	  }
	  
	  i+=len;
	  
	  logRaw("TLV [tag:"+tag+" len:"+len+" val:"+str+" text: "+str_b+"] ");
	}
}

function strTLVs(view,i,command_length) {

	var str_tlvs = "";

	while (i!=command_length) {
	  let tag  = view.getUint16(0*2+i,false);
	  let len  = view.getUint16(1*2+i,false);
	  
	  i+=4;
	  
	  var str = "",str_b = "";
	  for(var a=0;a<len;a++) {
	  	str += "0x"+pad(view.getUint8(i+a,false).toString(16),2)+" ";
	  	
	  	let v = view.getUint8(i+a,false);
	  	switch(v) {
		  	case 0: str_b += ' <kbd>00</kbd>'; break
		  	case 32: str_b += ' <kbd>SP</kbd>'; break;
		  	default:
		  		if ((v>32)&&(v<128)) str_b += " <code>"+String.fromCharCode(v)+"</code>";
		  		else {
		  			str_b += " <kbd>";
		  			str_b += pad(view.getUint8(i+a,false).toString(16),2);
		  			str_b += "</kbd>";
		  		}
	  	}
	  }
	  
	  i+=len;
	  
	  if (str_tlvs!="") str_tlvs += " ";
	  str_tlvs += '<span class="badge badge-warning text-dark rounded-pill">TLV tag:0x'+tag.toString(16)+' ('+smppTLVStr(tag)+') len:'+len+' val:'+str+' text: '+str_b+'</span>';
	}
	
	return str_tlvs;
}

function connect() {

	logLow("Connecting",false);

	$('#connect').prop('disabled', true);
	$('#disconnect').prop('disabled', false);
	
	smppSeqNoOut = 1;
	
	smppSocket = new WebSocket("wss://melroselabs.com/wssmpp/");
	smppSocket.binaryType = 'arraybuffer';
	
	smppSocket.onopen = function (event) {
	  console.log("Open");
	  logLow("Connected",true);
	  
	  smppBindTRX(formSystemID,formPassword,formSystemType,formAddressRange,formVersion);
	};
	
	smppSocket.onmessage = function (event) {
	  console.log(event);
	  
	  let view = new DataView(event.data,0);
	  
	  let command_length  = view.getUint32(0*4,false);
	  let command_id  = view.getUint32(1*4,false);
	  let command_status  = view.getUint32(2*4,false);
	  let sequence_number  = view.getUint32(3*4,false);
	  
	  console.log("> SMPP "+command_id.toString(16));
	  
	  //
	  
	  var str = "";
	  for(var i=16;i<event.data.byteLength;i++) {
	  	str += pad(view.getUint8(i,false).toString(16),2)+" ";
	  }
	  
	  //

	  if (command_id==0x80000009) { /* bind_transceiver_resp */
		  if (command_status==0) { /* bind successful */
		  	$("#accountDetailsPane").collapse("hide");

		  	stateBound = true;
		  	
		  	var i=16;
			var mc_system_id = getString(view,i);
			i += mc_system_id.length+1;
			
			var line = "";
			
			line += "MC System ID: <code>"+mc_system_id+"</code>";
			
			var str_tlvs = strTLVs(view,i,command_length);
		  	log(-1, command_id,command_status,sequence_number,line,str_tlvs);
		  }
		else {
			log(-1, command_id,command_status,sequence_number,str);
		}
	  }
	  
	  else if (command_id==0x80000004) { /*submit_sm_resp*/
	  	if (command_status==0) {
	  	  var i=16;
		  var message_id = getString(view,i);
		  i += message_id.length+1;
		  
		  var str_tlvs = strTLVs(view,i,command_length);
		  log(-1, command_id,command_status,sequence_number,"Message ID: <code>"+message_id+"</code>",str_tlvs);
		  
			if (typeof eventSubmitSMResp != 'undefined') {
				eventSubmitSMResp(command_status,sequence_number,message_id);
			}
		}
		else {
			log(-1, command_id,command_status,sequence_number,str);
			
			if (typeof eventSubmitSMResp != 'undefined') {
				eventSubmitSMResp(command_status,sequence_number,"");
			}
		}
	}
	  
	  else if (command_id==0x00000005) { /* deliver_sm */
		  var i=16;
		  
		  var service_type = getString(view,i);
		  i += service_type.length+1;
		  
		  var source_addr_ton = view.getUint8(i++,false);
		  var source_addr_npi = view.getUint8(i++,false);
		  var source_addr = getString(view,i);
		  i += source_addr.length+1;
		  
		  var dest_addr_ton = view.getUint8(i++,false);
		  var dest_addr_npi = view.getUint8(i++,false);
		  var destination_addr = getString(view,i);
		  i += destination_addr.length+1;
		  
		  var esm_class = view.getUint8(i++,false);
		  var protocol_id = view.getUint8(i++,false);
		  var priority_flag = view.getUint8(i++,false);
		  
		  var schedule_delivery_time = getString(view,i);
		  i += schedule_delivery_time.length+1;
		  
		  var validity_period = getString(view,i);
		  i += validity_period.length+1;
		  
		  var registered_delivery = view.getUint8(i++,false);
		  var replace_if_present_flag = view.getUint8(i++,false);
		  var data_coding = view.getUint8(i++,false);
		  var sm_default_msg_id = view.getUint8(i++,false);
		  var sm_length = view.getUint8(i++,false);
		  
		  var short_message = "";
		  for(var a=0;a<sm_length;a++) short_message += String.fromCharCode(view.getUint8(i++,false));
		  
		  var line = "";
		  
		  line += dv(source_addr_ton)+"."+dv(source_addr_npi)+"."+dv(source_addr)+">"+dv(dest_addr_ton)+"."+dv(dest_addr_npi)+"."+dv(destination_addr);
		  line += "; esm_class: "+dv(esm_class);
		  line += "; protocol_id: "+dv(protocol_id);
		  line += "; priority_flag: "+dv(priority_flag);
		  line += "; registered_delivery: "+dv(registered_delivery);
		  line += "; replace_if_present_flag: "+dv(replace_if_present_flag);
		  line += "; data_coding: "+dv(data_coding);
		  line += "; sm_default_msg_id: "+dv(sm_default_msg_id);
		  line += "; short_message: "+dv(short_message);
		  
		  var str_tlvs = strTLVs(view,i,command_length);
		  log(-1, command_id,command_status,sequence_number,line,str_tlvs);
		  
		  if (typeof eventDeliverSM != 'undefined') {
			  eventDeliverSM(source_addr,destination_addr,parseInt(esm_class),short_message);
		  }
		  
		  smppDeliverSMResp(sequence_number);
	  }
	  
	  else if ((command_id==0x80000006)||(command_id==0x00000006)) { /* unbind_resp or unbind */
	  	  stateBound = false;
		  log(-1, command_id,command_status,sequence_number,str);
		  disconnect();
		  
	  }
	  
	  else if (command_id==0x00000015) { /* enquire_link */
	  	  log(-1, command_id,command_status,sequence_number,str);
		  smppEnquireLinkResp(sequence_number);
	  }
	  
	  else {
	  	  var str_tlvs = strTLVs(view,i,command_length);
		  log(-1, command_id,command_status,sequence_number,str,str_tlvs);
	  }
	    
	  showState();
	}
	
	smppSocket.onclose = function (event) {
	  console.log("Close");
	  logLow("Disconnected",false);
	  stateBound = false;
	  showState();
	}
}

function disconnect() {
	if (stateBound) smppUnbind();
	else smppSocket.close();
}

function pad(n, width, z) {
	z = z || '0';
	n = n + '';
	return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

function smppTLVStr(tag) {
	switch (tag) {
		case 0x0005: return "dest_addr_subunit";
		case 0x0006: return "dest_network_type";
		case 0x0007: return "dest_bearer_type";
		
		case 0x0017: return "qos_time_to_live";
		case 0x0019: return "payload_type";
		case 0x001d: return "additional_status_info_text";
		case 0x001e: return "receipted_message_id";
		case 0x001f: return "ms_msg_wait_facilities";
		
		case 0x0204: return "user_message_reference";
		
		case 0x020c: return "sar_msg_ref_num";
		case 0x020e: return "sar_total_segments";
		case 0x020f: return "sar_segment_seqnum";
		case 0x0210: return "sc_interface_version";
		
		case 0x420: return "dpf_result";
		case 0x421: return "set_dpf";
		case 0x422: return "ms_availability_status";
		case 0x423: return "network_error_code";
		case 0x424: return "message_payload";
		case 0x425: return "delivery_failure_reason";
		case 0x426: return "more_messages_to_send";
		case 0x427: return "message_state";
	}
	return "UNKNOWN";
}

function smppCommandStr(command_id) {
	switch (command_id) {
		case 0x00000004: return "submit_sm";
		case 0x80000004: return "submit_sm_resp";
		case 0x00000005: return "deliver_sm";
		case 0x80000005: return "deliver_sm_resp";
		case 0x00000006: return "unbind";
		case 0x80000006: return "unbind_resp";
		case 0x00000009: return "bind_transceiver";
		case 0x80000009: return "bind_transceiver_resp";
		case 0x00000015: return "enquire_link";
		case 0x80000015: return "enquire_link_resp";
	}
	return "UNKNOWN";
}

function smppCmdStatusStr(command_status) {
	switch (command_status) {
		case 0x0: return "ROK";
		case 0x1: return "RINVMSGLEN";
		case 0x2: return "RINVCMDLEN";
		case 0x3: return "RINVCMDID";
		case 0x4: return "RINVBNDSTS";
		case 0x5: return "RALYBND";
		case 0x6: return "RINVPRTFLG";
		case 0x7: return "RINVREGDLVFLG";
		case 0x8: return "RSYSERR";
		case 0x9: return "RINVSRCADR";
		case 0xa: return "RINVSRCADR";
		case 0xb: return "RINVDSTADR";
		case 0xc: return "RINVMSG";
		case 0xd: return "RBINDFAIL";
		case 0xe: return "RINVPASWD";
		case 0xf: return "RINVSYSID";
		case 0x11: return "RCANCELFAIL";
		case 0x13: return "RREPLACEFAIL";
		case 0x14: return "RMSGQFUL";
		case 0x15: return "RINVSERTYP";
		case 0x33: return "RINVNUMDESTS";
		case 0x34: return "RRINVDLNAME";
		case 0x40: return "RINVDESTFLAG";
		case 0x42: return "RINVSUBREP";
		case 0x43: return "RINVESMCLASS";
		case 0x44: return "RCNTSUBDL";
		case 0x45: return "RSUBMITFAIL";
		case 0x48: return "RINVSRCTON";
		case 0x49: return "RINVSRCNPI";
		case 0x50: return "RINVDSTTON";
		case 0x51: return "RINVDSTNPI";
		case 0x53: return "RINVSYSTYP";
		case 0x54: return "RINVREPFLAG";
		case 0x55: return "RINVNUMMSGS";
		case 0x58: return "RTHROTTLED";
		case 0x61: return "RINVSCHED";
		case 0x63: return "RINVDFTMSGID";
		case 0x64: return "RX_T_APPN";
		case 0x65: return "RX_P_APPN";
		case 0x66: return "RX_R_APPN";
		case 0x67: return "RQUERYFAIL";
		case 0xc0: return "RINVTLVSTREAM";
		case 0xc1: return "RTLVNOTALLWD";
		case 0xc2: return "RINVTLVLEN";
		case 0xc3: return "RMISSINGTLV";
		case 0xc4: return "RINVTLVVAL";
		case 0xfe: return "RDELIVERYFAILURE";
		case 0xff: return "RUNKNOWNERR";
		case 0x100: return "RSERTYPUNAUTH";
		case 0x101: return "RPROHIBITED";
		case 0x102: return "RSERTYPUNAVAIL";
		case 0x103: return "RSERTYPDENIED";
		case 0x104: return "RINVDCS";
	}
	return "UNKNOWN";
}

/**/

function logRaw(str) {
	var badgeColour = "light";
	
	var localDateTime = new Date();
	var existingMessages = document.getElementById("message-area").innerHTML;
	if (existingMessages.length>10) existingMessages = '<br/>' + existingMessages;
	document.getElementById("message-area").innerHTML = '<small><span class="badge badge-'+badgeColour+'">' + pad(localDateTime.getHours(),2) + ":" + pad(localDateTime.getMinutes(),2) + ":" + pad(localDateTime.getSeconds(),2) + '</span>&nbsp;&nbsp;' + str + '</small>' + existingMessages;
	
}

function logLow(str,outcome) {
	var badgeColour = "dark";
	
	if (outcome) badgeColour = "secondary";
	
	var localDateTime = new Date();
	var existingMessages = document.getElementById("message-area").innerHTML;
	if (existingMessages.length>10) existingMessages = '<br/>' + existingMessages;
	document.getElementById("message-area").innerHTML = '<span class="badge bg-'+badgeColour+'">' + pad(localDateTime.getHours(),2) + ":" + pad(localDateTime.getMinutes(),2) + ":" + pad(localDateTime.getSeconds(),2) + '</span>&nbsp;&nbsp;' + str + '' + existingMessages;
	
}

function log(direction,command_id,command_status,sequence_number,str,str_tlvs) {
	var badgeColour = "secondary";
	
	var outcome = '<span class="badge bg-primary">' + smppCommandStr(command_id) + "</span>";
	
	if (command_id>=0x80000000) {
		if (command_status==0) outcome += ' <span class="badge bg-success">OK</span>';
		else outcome += ' <span class="badge bg-danger">ERROR: ' + smppCmdStatusStr(command_status) + ' (0x'+pad(command_status.toString(16),3)+')</span>';
	}
	
	outcome += " ";
	
	if (str) outcome += str;
	
	if (stateBound) badgeColour = "success";
	
	var seqno_block = "";
	switch (direction) {
		case 0: chDir = '-'; break;
		case 1: chDir = '&lt;'; break;
		case -1: chDir = '&gt;'; break;
	}
	seqno_block = '<span class="badge bg-info text-dark"> ' + pad(sequence_number,4) + ' ' + chDir + '</span>' + '&nbsp;';
	
	var localDateTime = new Date();
	
	var outline = "";
	
	outline += '<div class="row border-bottom">';
	
	outline += '<div class="col-2">';
	outline += '<span class="badge bg-'+badgeColour+'">' + pad(localDateTime.getHours(),2) + ":" + pad(localDateTime.getMinutes(),2) + ":" + pad(localDateTime.getSeconds(),2) + '</span>&nbsp;&nbsp;' + seqno_block;
	outline += '</div>';
	
	outline += '<div class="col-10 pb-1">';
	outline += outcome + '&nbsp;&nbsp;';
	
	if (str_tlvs) outline += '<br/>'+str_tlvs;
	outline += '</div>';
	
	outline += '</div>';
	
	var existingMessages = document.getElementById("message-area").innerHTML;
	
	document.getElementById("message-area").innerHTML = outline + existingMessages;
}

/**/

function sendSMPPCmd(buffer,command_id,logit=true) {
	
	if (logit) log(1, command_id,0,smppSeqNoOut);

	const uint8 = new Uint8Array(buffer);
	uint8.set([command_id],7); // 0x00000009
	uint8.set([smppSeqNoOut++],15);
	smppSocket.send(buffer);
}

function sendSMPPResp(buffer,command_id,sequence_number) {
	const uint8 = new Uint8Array(buffer);
	uint8.set([0x80],4); 
	uint8.set([command_id & 0xff],7); 
	uint8.set([sequence_number],15);
	smppSocket.send(buffer);

	log(1, command_id,0,sequence_number);
}

/**/

function smppBindTRX(systemid,password,systemtype,addressrange,version) {

	log(1, 0x00000009,0,smppSeqNoOut,"system ID: "+dv(systemid)+"; system type: "+dv(systemtype)+"; address range: "+dv(addressrange) + "; version:" + dv(" 0x"+parseInt(version,10).toString(16)) );

	var smppHeadLen=16;
	var smppBodyLen=systemid.length+1 + password.length+1 + systemtype.length+1 + 1 + 1 + 1 + addressrange.length+1;
	
	var buffer = new ArrayBuffer(smppHeadLen+smppBodyLen);
	const uint8 = new Uint8Array(buffer);
	
	uint8.set([smppHeadLen+smppBodyLen],3);
	
	var i=16;

	for(var a=0; a<systemid.length; a++) uint8[i++] = systemid.charCodeAt(a);
	uint8[i++]=0;
	
	for(a=0;a<password.length;a++) uint8[i++] = password.charCodeAt(a);
	uint8[i++]=0;
	
	for(a=0;a<systemtype.length;a++) uint8[i++] = systemtype.charCodeAt(a);
	uint8[i++]=0;
	
	uint8[i++]=version; // interface version
	
	uint8[i++]=0x0; // TON
	
	uint8[i++]=0x0; // NPI
	
	for(a=0;a<addressrange.length;a++) uint8[i++] = addressrange.charCodeAt(a);
	uint8[i++]=0;
	
	sendSMPPCmd(buffer,0x00000009,false);
}

function smppUnbind() {

	var smppHeadLen=16;
	
	var buffer = new ArrayBuffer(smppHeadLen);
	const uint8 = new Uint8Array(buffer);
	
	uint8.set([smppHeadLen],3);
	
	sendSMPPCmd(buffer,0x00000006);
}

function smppSubmitsM(source_addr_ton,source_addr_npi,source_addr,dest_addr_ton,dest_addr_npi,destination_addr,schedule_delivery_time,validity_period,registered_delivery,short_message) {

	smppSeqNo = smppSeqNoOut;

	log(1, 0x00000004,0,smppSeqNoOut,dv(source_addr_ton)+"."+dv(source_addr_npi)+"."+dv(source_addr)+">"+dv(dest_addr_ton)+"."+dv(dest_addr_npi)+"."+dv(destination_addr)+"; registered_delivery: "+dv(registered_delivery)+"; short_message: "+dv(short_message));

	var smppHeadLen=16;
	var smppBodyLen=1+1+1+source_addr.length+1+1+1+destination_addr.length+1+1+1+1+schedule_delivery_time.length+1+validity_period.length+1+1+1+1+1+1+short_message.length;
	
	var buffer = new ArrayBuffer(smppHeadLen+smppBodyLen);
	const uint8 = new Uint8Array(buffer);
	
	uint8.set([smppHeadLen+smppBodyLen],3);
	
	var i=16;
	
	uint8[i++]=0x0; // service type
	
	uint8[i++]=source_addr_ton; // TON
	uint8[i++]=source_addr_npi; // NPI
	for(a=0;a<source_addr.length;a++) uint8[i++] = source_addr.charCodeAt(a);
	uint8[i++]=0;
	
	uint8[i++]=dest_addr_ton; // TON
	uint8[i++]=dest_addr_npi; // NPI
	for(a=0;a<destination_addr.length;a++) uint8[i++] = destination_addr.charCodeAt(a);
	uint8[i++]=0;
	
	uint8[i++]=0x0; // esm_class
	
	uint8[i++]=0x0; // protocol_id
	
	uint8[i++]=0x0; // priority_flag
	
	for(var a=0; a<schedule_delivery_time.length; a++) uint8[i++] = schedule_delivery_time.charCodeAt(a);
	uint8[i++]=0;
	
	for(var a=0; a<validity_period.length; a++) uint8[i++] = validity_period.charCodeAt(a);
	uint8[i++]=0;
	
	uint8[i++]=registered_delivery; // registered_delivery
	
	uint8[i++]=0x0; // replace_if_present_flag
	
	uint8[i++]=0x0; // data_coding
	
	uint8[i++]=0x0; // sm_default_msg_id
	
	uint8[i++]=short_message.length; // sm_length
	
	for(a=0;a<short_message.length;a++) uint8[i++] = short_message.charCodeAt(a);
	
	sendSMPPCmd(buffer,0x00000004,false);
	
	return smppSeqNo;
}

function smppDeliverSMResp(sequence_number) {

	var smppHeadLen=16;
	
	var buffer = new ArrayBuffer(smppHeadLen+1);
	const uint8 = new Uint8Array(buffer);
	
	uint8.set([smppHeadLen+1],3);
	
	uint8[16]=0x0;
	
	sendSMPPResp(buffer,0x80000005,sequence_number);
}

function smppEnquireLink() {

	var smppHeadLen=16;
	
	var buffer = new ArrayBuffer(smppHeadLen);
	const uint8 = new Uint8Array(buffer);
	
	uint8.set([smppHeadLen],3);
	
	sendSMPPCmd(buffer,0x00000015);
}

function smppEnquireLinkResp(sequence_number) {

	var smppHeadLen=16;
	
	var buffer = new ArrayBuffer(smppHeadLen);
	const uint8 = new Uint8Array(buffer);
	
	uint8.set([smppHeadLen],3);
	
	sendSMPPResp(buffer,0x80000015,sequence_number);
}
