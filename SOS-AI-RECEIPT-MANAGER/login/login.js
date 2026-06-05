function register(){

    const email = document.getElementById("register-email").value;
    const password = document.getElementById("register-password").value;

    if(email === "" || password === ""){
        alert("Please fill all fields");
        return;
    }

    localStorage.setItem("userEmail", email);
    localStorage.setItem("userPassword", password);

    alert("Registration Successful");

    window.location.href = "login.html";
}



function login(){

    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    const savedEmail = localStorage.getItem("userEmail");
    const savedPassword = localStorage.getItem("userPassword");

    if(email === savedEmail && password === savedPassword){

        localStorage.setItem("isLoggedIn", "true");

        alert("Login Successful");

        window.location.href = "../index.html";

    }else{

        alert("Invalid Email or Password");
    }
}



function forgotPassword(){

    const email = document.getElementById("forgot-email").value;

    const savedEmail = localStorage.getItem("userEmail");

    if(email === savedEmail){

        alert("Your password is: " + localStorage.getItem("userPassword"));

    }else{

        alert("Email not found");
    }
}