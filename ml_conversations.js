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

var formSystemID,formPassword,formSystemType,formAddressRange,formVersion;
var inboundCustomerID = 1000;

/* enter mobile number to add new chat box */

function startConvKeyPress(txt) {
	$('#startconversation').prop('disabled', txt.value=='');
}

function addChatCard(name,destinationMobile,outboundInitiated) {

	if (outboundInitiated) { cardColour = "danger"; indicator = '<i class="fas fa-caret-right"></i> <i class="fas fa-user-circle"></i>'; }
	else { cardColour = "warning"; indicator = '<i class="fas fa-caret-left"></i> <i class="fas fa-user-circle"></i> '; }

	const newContent = document.createElement('div');
	newContent.innerHTML = '<div class="col"><div class="card chatcard border-'+cardColour+'">  <div class="card-header bg-'+cardColour+'"><span class="text-light">'+indicator+' '+name+' <small>('+destinationMobile+')</small></span></div>  <div class="card-body" id="messages'+destinationMobile+'" name="messages'+destinationMobile+'"> </div>  <div class="card-footer"><div class="input-group">					<input type="text" class="form-control" id="smppMessage'+destinationMobile+'" name="smppMessage'+destinationMobile+'" placeholder="Message" aria-label="Message" aria-describedby="smppMessage">					<button class="btn btn-outline-secondary" type="button" id="submitsm'+destinationMobile+'" data-mobile="'+destinationMobile+'" onclick="sendMessage(this)">Send</button>				</div></div>  </div></div>';
	
	// add the newly created element and its content into the DOM
	const currentDiv = document.getElementById("chatPanel");
	
	//
	
	if (currentDiv.childNodes.length>0) currentDiv.insertBefore(newContent, currentDiv.childNodes[0]);
	else currentDiv.appendChild(newContent);
	
	// add to conversations list
	
	let li = document.createElement('li');
	li.innerHTML = '<span class="text-'+cardColour+'">'+ name+' ('+destinationMobile+')</span>';
	li.classList.add("list-group-item");
	document.querySelector('#conversationsList').appendChild(li);
}

/* send message */

function addZero(i) {
  if (i < 10) {
    i = "0" + i;
  }
  return i;
}

function scroll(id) {
	var messages = document.getElementById(id);
	messages.scrollTop = messages.scrollHeight;
}

function sendMessage(card) {
	
	var mobile = $( "#"+card.id ).data( "mobile" );
	var message = $("#smppMessage"+mobile).val();
	
	var seqNo = smppSubmitsM(
	1,1,$('#sourceAddress').val().toString(),
	1,1,mobile.toString(),
	"","",1 /* registered delivery */,
	message);
	
	if (seqNo>0) { /* submit attempted */
	
		var d = new Date();
		var ts = addZero(d.getHours()) + ":" + addZero(d.getMinutes());
		
		$("#messages"+mobile).html( $("#messages"+mobile).html() + '<div class="text-end bg-light chat-balloon" id="seqno'+seqNo+'">' + message + ' <span class="text-secondary chat-time">' + ts + ' </span></div>' );
		
		scroll("messages"+mobile);
		
		$("#smppMessage"+mobile).val("");
	
	}
}

function eventDeliverSM(source_addr,destination_addr,esm_class,short_message) {
	
	var mobile = source_addr;
	
	var d = new Date();
	var ts = addZero(d.getHours()) + ":" + addZero(d.getMinutes());
	
	var content = "";
	if (esm_class==0) {
		content = short_message;
		$("#messages"+mobile).html( $("#messages"+mobile).html() + '<div class="text-start bg-light"><span class="text-secondary chat-time">' + ts + '</span> ' + content + '</div>' );
	}
	else if (esm_class==4) { /* delivery receipt */
	
		var messageid = short_message.split(/[: ]/)[1];
		
		console.log(messageid);
		
		var outcome = false; // assume failed
	
		if (-1 != short_message.indexOf("stat:DELIV",0)) { outcome = true; }
		
		var outcomeText = '<span style="color: red;"><i class="fas fa-times"></i></span>';
		if (outcome) outcomeText = '<span style="color: green;"><i class="fas fa-check"></i></span>';
		$( "#msgid"+messageid ).find("span").html( $( "#msgid"+messageid ).find("span").html()+outcomeText );

	}
	
	scroll("messages"+mobile);
}

function eventSubmitSMResp(cmdstatus,seqno,messageid) {
	if (cmdstatus==0) { // successful submit
		console.log(seqno + ' ' + messageid);
		
		$("#seqno"+seqno).attr("id","msgid"+messageid);
	}
}

$(document).ready(function () {

	/* */

	$("#connect").click(function() {
	
		formSystemType = "";
		formAddressRange = "";
		
		formSystemID = $("#inputSystemID").val(); 
		formPassword = $("#inputPassword").val();
		formVersion = 52; // 0x34
		
		connect();
		
	});
	
	$("#disconnect").click(function() {disconnect();});
	
	/* */
	
	$("#startconversation").click(function() {
	
		newName = $("#inputNewName").val();
		newName = newName.trim();
		
		if (newName == '') newName = 'Unnamed';
		
		newDestination = $("#inputNewDestination").val();
		newDestination = newDestination.trim();
		newDestination = newDestination.replace(/[^0-9.]/g, '');
		
		$("#inputNewName").val("");
		$("#inputNewDestination").val("");
	
		addChatCard(newName,newDestination,true);
	});
	
	$("#startconversation_simulateinbound").click(function() {
	
		newName = $("#inputNewName").val();
		newName = newName.trim();
		var ts = Date();
		if (newName == "") newName = "C"+inboundCustomerID;
		inboundCustomerID++;
		
		newDestination = $("#inputNewDestination").val();
		newDestination = newDestination.trim();
		newDestination = newDestination.replace(/[^0-9.]/g, '');
		
		if (newDestination=='') return;
		
		$("#inputNewName").val("");
		$("#inputNewDestination").val("");
	
		addChatCard(newName,newDestination,false);
	});
	
	$("#submitsm").click(function() {
		formSourceAddress = $('#sourceAddress').val();
		formDestinationAddress = $('#destinationAddress').val();
		formRegisteredDelivery = 1; /* registered delivery */
		formShortMessage = $('#smppMessage').val();
		
		smppSubmitsM(
			1,1,formSourceAddress,
			1,1,formDestinationAddress,
			"","",formRegisteredDelivery,
			formShortMessage);
	});
	
	//$("#enquirelink").click(function() {
	//	smppEnquireLink();
	//});
	
	$("#logclear").click(function() {
		document.getElementById("message-area").innerHTML = "";
	});

});
