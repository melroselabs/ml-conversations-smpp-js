# ml-conversations-smpp-js
Conversational multi-chat SMS text messaging user interface using SMPP over Web Sockets and JavaScript

<img width="800" alt="Screenshot 2021-04-10 at 15 47 05" src="https://user-images.githubusercontent.com/52739488/114274021-7fdac800-9a14-11eb-8ee7-5864b9d4430c.png">

Example conversational UI comprising:

- SMPP over Web Sockets between browser and web server
- SMPP library (simple) in JavaScript
- Multiple chats based on mobile number
- Inbound (MO) and outbound (MT) SMS
- Delivery confirmation (using delivery receipts)

This project is not intended as best practice in conversational UI design, however its purpose is to demonstrate how relatively simple it is to implement a conversational application and UI using web technologies, SMPP and a suitably capable SMS gateway provider.

Further improvements are required to address robustness, message entry, connection stability/keep-alive, and chat management.
