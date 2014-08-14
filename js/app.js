var UCE = window.UCE || {},
    Handlebars = window.Handlebars,
    lscache = window.lscache;

// From: http://bit.ly/1gAKKPP
function isInPhoneGap() {
  return !(/^http[s]?:\/\//).test(document.URL);
}

// Wait for PhoneGap to initialize
UCE.deviceReadyDfd = new $.Deferred();
if (isInPhoneGap()) {
  document.addEventListener('deviceready', UCE.deviceReadyDfd.resolve, true);
} else {
  // If not in phonegap (i.e. web dev) just resolve immediately
  UCE.deviceReadyDfd.resolve();
}

UCE.log = function (s) {
  console.log('UCE: ' + s);
};

UCE.cancelEvent = function (e) {
  if (!e) { return false; }
  e.preventDefault();
  e.stopPropagation();
  return false;
};

UCE.init = function () {
  UCE.log('App ready!');
  UCE.bindListeners();

  if (UCE.isLoggedIn()) {
    UCE.showScan();
  } else {
    UCE.showLogin();
  }
};

UCE.bindListeners = function () {
  $('.btn-login').on('click', UCE.submitLogin);
  $('.btn-refresh').on('click', UCE.refreshLogin);
  $('.btn-scan').on('click', UCE.scanTicket);
  $('.btn-scan-again').on('click', UCE.scanAgain);
  $('.btn-submit').on('click', UCE.submitManualCode);
  $('.hide').on('click', UCE.reset);
};

UCE.showPage = function (selector) {
  var $el = $(selector),
      dfd = new $.Deferred(),
      logo, clientName;

  UCE.log('Showing page ' + selector);
  $el.addClass('show');

  if (selector === '.page-scan') {
    logo = UCE.getLogoUrl();
    if (logo) { $('.header img').attr('src', logo).show(); }
    clientName = UCE.getClientName();
    if (clientName) { $('.client-name').text(clientName); }
  } else if (selector === '.page-login') {
    $('.header img').attr('src', '').hide();
    $('.client-name').text('');
  }

  requestAnimationFrame(function () {
    UCE.log('Frame 1 ');
    requestAnimationFrame(function () {
      UCE.log('Frame 2 - adding fadein ');
      if (!$el.hasClass('fadein')) {
        $el.one('transitionend', dfd.resolve);
        $el.addClass('fadein');
      } else {
        dfd.resolve();
      }
    });
  });

  return dfd.promise().then(function () { UCE.log('Done animation'); });
};

UCE.hidePage = function (selector) {
  var $el = $(selector),
      dfd = new $.Deferred();

  UCE.log('Hiding page ' + selector);

  if ($el.hasClass('fadein')) {
    $el.one('transitionend', dfd.resolve);
    $el.removeClass('fadein');
  } else {
    dfd.resolve();
  }

  return dfd.promise().then(function () {
    UCE.log('Fade done');
    requestAnimationFrame(function () {
      UCE.log('Removing show class');
      $el.removeClass('show');
    });
  });
};

UCE.showValid = _.partial(UCE.showPage, '.page-valid');
UCE.showInvalid = _.partial(UCE.showPage, '.page-invalid');
UCE.showLogin = _.partial(UCE.showPage, '.page-login');
UCE.showScan = _.partial(UCE.showPage, '.page-scan');
UCE.showLocked = _.partial(UCE.showPage, '.page-locked');
UCE.hideValid = _.partial(UCE.hidePage, '.page-valid');
UCE.hideInvalid = _.partial(UCE.hidePage, '.page-invalid');
UCE.hideLogin = _.partial(UCE.hidePage, '.page-login');
UCE.hideScan = _.partial(UCE.hidePage, '.page-scan');
UCE.hideLocked = _.partial(UCE.hidePage, '.page-locked');

UCE.ajax = function (step, data) {
  var endpoint = 'http://www.upcomingevents.com/ticketscanner/process.asp';

  if (!data) { data= {}; }

  data.step = step;

  return $.ajax({
    url: endpoint,
    dataType: 'json',
    data: data
  });
};

UCE.loginAjax = function (username, password) {
  var dfd = new $.Deferred(),
      data = {
        username: username,
        password: password,
        clientId: UCE.getClientId(),
        appSessionId: UCE.getAppSessionId(),
        apptype: UCE.getPlatformType(),
        platform: UCE.getPhoneAndVersion()
      };

  return UCE.ajax('login', data);
};

UCE.getPlatformType = function () {
  var platform;
  if (window.device && window.device.platform) {
    platform = window.device.platform.toLowerCase();
    if (platform === 'android') {
      return 'a';
    } else if (platform === 'ios') {
      return 'i';
    }
  }
  return 'unknown platform';
};

UCE.getPhoneModel = function () {
  if (window.device && window.device.model) {
    return window.device.model;
  }
  return 'unknown model';
};

UCE.getPlatformVersion = function () {
  if (window.device && window.device.version) {
    return window.device.version;
  }
  return 'unknown version';
};

UCE.getPhoneAndVersion = function () {
  return UCE.getPhoneModel() + ' - ' + UCE.getPlatformVersion();
};

UCE.getClientId = function () {
  return 'dummyClientId';
};

UCE.generateAppSessionId = function () {
  var id = Math.floor(Math.random()*8999999999+1000000000);
  lscache.remove('appSessionId');
  lscache.set('appSessionId', id, 30);
  return id;
};

UCE.isAppSessionIdExpired = function () {
  return lscache.get('appSessionId') == null;
};

UCE.getAppSessionId = function () {
  if (!UCE.isAppSessionIdExpired()) {
    return lscache.get('appSessionId');
  }
  return UCE.generateAppSessionId();
};

UCE.getClientName = function () {
  return window.lscache.get('ClientName');
};

UCE.isLoggedIn = function () {
  var clientName = window.lscache.get('ClientName');
  return clientName != null && !UCE.isAppSessionIdExpired();
};

UCE.cacheLogin = function (response) {
  UCE.clearLogin();
  window.lscache.set('ClientName', response.ClientName, 30);
  window.lscache.set('LogoURL', response.LogoURL, 30);
};

UCE.clearLogin = function (response) {
  window.lscache.remove('ClientName');
  window.lscache.remove('LogoURL');
};

UCE.getLogoUrl = function () {
  return window.lscache.get('LogoURL');
};

UCE.submitLogin = function (e) {

  var username, password;

  UCE.cancelEvent(e);

  function success(response) {
    if (response.valid) {
      UCE.cacheLogin(response);
      return UCE.hideLogin().then(UCE.showScan);
      $('.page-login .error').hide().text('');
    }

    UCE.clearLogin(response);
    if (response.locked) {
      UCE.hideLogin().then(UCE.showLocked);
    } else {
      $('.page-login .error').text(response.Message).show();
    }
  }

  function error(e) {
    UCE.log('Could not login');
    $('.page-login .error').text('Login could not be processed.  ' +
                                 'Please make sure you have ' +
                                 'a valid internet connection and ' +
                                 'try again.').show();
  }

  function enhanceData(data) {
    if (data.response.status === '-1') {
      data.response.valid = false;
      data.response.locked = true;
    } else if (data.response.status === '0') {
      data.response.valid = false;
    } else {
      data.response.valid = true;
    }
    return data.response;
  }

  username = $('#username').val();
  password = $('#password').val();

  if (username.length === 0 || password.length === 0) {
    window.alert('Please enter a username and password');
    return;
  }

  return UCE.loginAjax(username, password)
            .then(enhanceData)
            .done(success)
            .fail(error);
};

UCE.refreshLogin = function (e) {
  UCE.cancelEvent(e);
  UCE.hideLocked().then(UCE.showLogin);
};

UCE.reset = function (e) {
  UCE.cancelEvent(e);
  UCE.hideValid();
  UCE.hideInvalid();
  $('.input-qrcode').val('');
};

UCE.scanAgain = function (e) {
  UCE.cancelEvent(e);

  UCE.hideValid().then(UCE.scanTicket);
};

UCE.scanTicket = function (e) {
  var scanner = UCE.getBarcodeScanner();

  UCE.cancelEvent(e);

  function success(result) {
    if (result.cancelled !== 0) {
      UCE.log('User cancelled the scan.');
      return;
    } else if (result.format !== 'QR_CODE') {
      UCE.log('QR code not found.');
      return;
    }

    UCE.log('Scanned code: ' + result.text);
    UCE.submitTicket(result.text);
  }

  function error () {
    UCE.showInvalid();
  }

  if (!scanner) {
    success({
      cancelled: 0,
      format: 'QR_CODE',
      text: window.prompt('Enter a code', '123456789')
    });
    return;
  }

  scanner.scan(success, error);
};

UCE.getBarcodeScanner = function () {
  if (window.cordova && window.cordova.plugins &&
      window.cordova.plugins.barcodeScanner) {
    return window.cordova.plugins.barcodeScanner;
  }
  return null;
};

UCE.submitManualCode = function (e) {
  var $code = $('.input-qrcode'),
      code = $code.val();

  if (code.trim() === '') {
    UCE.log('Invalid code entered');
    window.alert('Please enter a valid Ticket Code');
    return;
  }

  UCE.cancelEvent(e);
  UCE.submitTicket(code);
};

UCE.ticketAjax = function (code) {
  var dfd = new $.Deferred();

  setTimeout(function () {
    var mockData;

    if (Math.random() < 0.1) {
      return dfd.reject();  // Mimic failed ajax request
    } else if (Math.random() < 0.55) {
      mockData = {
        response: {
          status: '1',
          TicketType: 'VIP'
        }
      };
    } else {
      mockData = {
        response: {
          status: '0',
          TicketType: null
        }
      };
    }

    dfd.resolve(mockData);
  }, 1000);

  UCE.log('Faking ajax call..');
  return dfd.promise();
};

UCE.submitTicket = function (code) {

  function success(response) {
    var source, template;
    if (response.valid) {
      source = $('#tpl-valid').html();
      template = Handlebars.compile(source);
      $('.page-valid .content').html(template(response));
      return UCE.showValid();
    } else {
      source = $('#tpl-invalid').html();
      template = Handlebars.compile(source);
      $('.page-invalid .content').html(template(response));
      return UCE.showInvalid();
    }
  }

  function error(e) {
    UCE.log('Could not submit ticket');
    window.alert('Ticket could not be submitted.  Please make sure you have ' +
                 'a valid internet connection and try again.');
  }

  function enhanceData(data) {
    data.response.valid = (data.response.status === '1');
    data.response.TicketCode = code;
    return data.response;
  }

  return UCE.ticketAjax(code)
            .then(enhanceData)
            .done(success)
            .fail(error);
};

UCE.deviceReadyDfd.promise().done(UCE.init);
