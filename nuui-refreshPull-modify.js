define(function (require, exports, module) {

	var rAF = window.requestAnimationFrame ||
		window.webkitRequestAnimationFrame ||
		window.mozRequestAnimationFrame ||
		window.oRequestAnimationFrame ||
		window.msRequestAnimationFrame ||
		function(callback){ return setTimeout(callback, 1)};

	var Refresh = module.exports = function(wrapper, config){
		this.initialize(wrapper, config);
	};

	Refresh.prototype = {

		initialize: function(wrapper, config){
			this._config = $.extend({}, this._defaultConfig, config);

			// 设css的兼容属性
			this._setCssProps();

			// 设定容器
			this._setTarget($(wrapper), config);

			// 生成icon
			this._buildIcon();

			// 根据用户的设定来计算icon拖拽时的滚动速度等等
			this._calcRuns();

			// 绑定事件
			this._$container.on(this._begin_event, $.proxy(this._onTouchStart, this));
		},

		_defaultConfig: {
			// 拖拽icon的最大距离, 也是触发加载的距离边缘
			triggerOffset: 150,
			// loading等待的最大时间
			waiting: 30000,

			// 收回icon的回滚次数
			resetRuns: 2,
			// 收回icon的回滚时间
			resetDuration: 1000,
			// icon内容
			renderer: function(){
				return $('<img src="./img/iconfont-loading.png">');
			},
			// 公开方法: 重新获取数据
			refreshData: null,
			// 公开方法: 加载更多数据
			loadMoreData: null,
			// 公开方法: 模板
			dataRenderer: null,
			// 选择向上拉向下拉的功能
			//enablePullDown: true,
			//enablePullUp: true
		},

		saveData:{
			dragY:0,
			deg:0
		},

		STATUS_PULLING_DOWN: 1,

		STATUS_TRIGGER_PULL_DOWN: 2,

		STATUS_PULLING_UP: 3,

		STATUS_TRIGGER_PULL_UP: 4,

		_begin_event: ("ontouchstart" in document) ? "touchstart" : "mousedown",

		_move_event: ("ontouchmove" in document) ? "touchmove" : "mousemove",

		_end_event: ("ontouchend" in document) ? "touchend" : "mouseup",

		_status: null,

		_iconDeg: 0,

		_setTarget: function($wrapper){

			$wrapper.css({position: 'relative', overflow: 'hidden'});

			this._wrapperH = $wrapper.outerHeight();

			if(this._config.containerSelector){
				this._$container = $wrapper.find(this._config.containerSelector);
			}else{
				this._$container = $wrapper.children().eq(0);
			}

			// 给内容添加一个外框作为scroll的容器
			this._$container.wrap('<div>');

			this._$wrapper = this._$container.parent()
				.css({
					"overflow-y": "auto",
					"-webkit-overflow-scrolling": "touch",
					height: this._wrapperH
				});
		},

		_calcRuns: function(){
			// icon滚一圈所用时间
			this._circleDuration = this._config.resetDuration / this._config.resetRuns;

			// icon每滚1deg所变化的高度
			this._dragDegPerY = (this._config.resetRuns * 360) / this._config.triggerOffset;

			// icon每滚1deg所过渡的时间
			this._resetDegPerTime = 360 / this._circleDuration;
		},

		_buildIcon: function(){
			var iconCss = {position: 'absolute', 'z-index': 999, opacity: 0};
			this._$wrapper
				.before(
				this._$topIconWrap = $('<div class="nu-refreshPull PullDown">')
					.css(iconCss)
					.append(
					this._$topIcon = this._config.renderer()
				)
			);

			if(this._config.enablePullUp){
				this._$wrapper.after(
					this._$footIconWrap = $('<div class="nu-refreshPull PullUp">')
						.css(iconCss)
						.append(
						this._$footIcon = this._config.renderer()
					)
				);
			}
			var iconH = this._$topIconWrap.outerHeight() * 1.1;
			//取得高度后设icon的位置
			this._$topIconWrap.css({top: -iconH + 'px', bottom: 'auto'});
			this._$footIconWrap.css({top: 'auto', bottom: -iconH + 'px'});
		},

		_onTouchStart: function(e){
			if(this._status){//console.log("正在处理中");
				return
			}
			// 超出阈值时的起始坐标
			this._touchBeginY = this._getY(e);
			// 滑动时重新计算container高度
			this._maxScrollH = this._$wrapper[0].scrollHeight - this._$wrapper[0].clientHeight;

			this._$container.on(this._move_event, $.proxy(this._onTouchMove, this));
			this._$container.on(this._end_event, $.proxy(this._onTouchEnd, this));
		},

		_onTouchMove: function(e){

			if(this._status != null){

				var dragY = this._getY(e) - this._beginY;

				if ((this._status == this.STATUS_PULLING_DOWN || this._status == this.STATUS_TRIGGER_PULL_DOWN) && dragY > 0){

					e.preventDefault();

					if (this._getY(e) - this._beginY > this._config.triggerOffset){
						this._status = this.STATUS_TRIGGER_PULL_DOWN;
					} else {
						this._status = this.STATUS_PULLING_DOWN;
					}
					this._draggingY = dragY;
					this._dragIcon(e, 'initOnly');

				} else if ((this._status == this.STATUS_PULLING_UP || this._status == this.STATUS_TRIGGER_PULL_UP) && dragY < 0){

					e.preventDefault();

					if (this._beginY - this._getY(e) > this._config.triggerOffset){
						this._status = this.STATUS_TRIGGER_PULL_UP;
					} else {
						this._status = this.STATUS_PULLING_UP;
					}
					this._draggingY = dragY;
					this._dragIcon(e, 'initOnly');
				}
			}else{
				var scrollTop = this._$wrapper.scrollTop();
				var y = this._getY(e);
				var moveY = y - this._touchBeginY;

				if (scrollTop == 0 && moveY > 0){
					this._status = this.STATUS_PULLING_DOWN;
					this._beginY = y;
				}else if(Math.abs(this._maxScrollH - scrollTop) <= 1 && moveY < 0){
					this._status = this.STATUS_PULLING_UP;
					this._beginY = y;
				}else{
					this._status = null;
				}
			}
		},

		_onTouchEnd: function(){
			var _this = this;
			//console.log('_onTouchEnd _status =', this._status);
			this._$container.off(this._move_event);
			this._$container.off(this._end_event);
			this.rAF_dragIcon = false;

			if(this._status == this.STATUS_TRIGGER_PULL_DOWN){
				this._setIconRun();
				this._refreshData();
			}else if(this._status == this.STATUS_TRIGGER_PULL_UP){
				this._setIconRun();
				this._loadMoreData();
			}else if(this._status == this.STATUS_PULLING_DOWN || this._status == this.STATUS_PULLING_UP){
				this._resetIcon({
					callback: function(){
						_this._status = null;
					}
				});
			}

		},

		_setIconRun: function(){
			// 本方法是icon进入loading状态的不断滚动, 但有定时退出loading状态
			var _this = this;
			// icon的loading状态时间是等于等待时间加上回滚时间
			var loadingDuration = this._config.waiting + this._config.resetDuration;
			var waitingRunDeg = loadingDuration * this._resetDegPerTime;
			var runDeg = (this._iconDeg || 0) - waitingRunDeg;

			// 先设iconWrap的位置在triggerOffset的高度
			//this._setIconPos(this._config.triggerOffset, this._$funcIconWrap);
			//this._$funcIconWrap.position();// 若加载是一瞬间的, 会没有动画效果, 这个方法可以解决一下

			// css过渡-旋转
			this._setTransition(this._$funcIcon, loadingDuration);
			this._rotateIcon(runDeg, this._$funcIcon);

			this._timeFunc = setTimeout(function(){
				_this._resetIcon({
					callback: function(){
						_this._status = null;
					}
				});
			}, this._config.waiting);
		},

		_resetIcon: function(options){
			clearTimeout(this._timeFunc);

			var _this = this;
			var resetDuration;

			if(this._status == this.STATUS_PULLING_DOWN || this._status == this.STATUS_PULLING_UP){
				resetDuration = this._iconDeg / 360 * this._circleDuration;
				// css过渡旋转
				this._setTransition(_this._$funcIcon, resetDuration);
				this._rotateIcon(0, this._$funcIcon);
			} else {
				// 不需要考虑icon的旋转问题, 因为在icon退回到顶部前预留了一段时间给旋转
				resetDuration = this._config.resetDuration;
			}

			// css过渡位移
			this._setTransition(_this._$funcIconWrap, resetDuration);
			this._setIconPos(0, this._$funcIconWrap);

			setTimeout(function(){
				// 设icon的css过渡都为0, 表示取消动画
				_this._setTransition(_this._$funcIconWrap, 0);
				_this._setTransition(_this._$funcIcon, 0);

				_this._rotateIcon(0, _this._$funcIcon);

				_this._renderFuncIcon(0);
				if(options && options.callback)options.callback();
			}, resetDuration);
		},

		_getY: function(e){
			var e = e.originalEvent || e;
			return ("changedTouches" in e) ? e.changedTouches[0].pageY : e.pageY;
		},

		_refreshData: function(){
			this._config.refreshData($.proxy(this._refreshRender, this));
		},

		_loadMoreData: function(){
			this._config.loadMoreData($.proxy(this._loadMoreRender, this));
		},

		_refreshRender: function(datas){
			this._clearItems();
			this._appendItems(datas);
		},

		_loadMoreRender: function(datas){
			this._appendItems(datas);
		},

		_clearItems: function(){
			this._$container.empty();
			this._items = [];
		},

		_appendItem: function(data){
			var item = this._config.dataRenderer(data);
			this._items.push(item);
			item.appendTo(this._$container);
		},

		_appendItems: function(datas){
			for(var i = 0; i < datas.length; i++){
				this._appendItem(datas[i]);
			}
			this._refresh();
		},

		_refresh: function(){
			var _this = this;
			if(this._items.length == 0){
				this._$container.append(
					this._noDataTipEl = $(this.NO_DATA_HTML).css("height", this._$wrapper.outerHeight(true))
				)
			}else{
				// 顺利获取数据的状态
				if(this._noDataTipEl){
					this._noDataTipEl.hide();
				}
			}
			this._resetIcon({
				callback: function(){
					_this._status = null;
				}
			});
		},

		_renderFuncIcon: function(mode){
			// 选择当前操作的icon
			if(mode !== this._mode){
				this._mode = mode;
				if(mode === this.STATUS_PULLING_DOWN){//console.log('选择top');
					this._$funcIcon = this._$topIcon;
					this._$funcIconWrap = this._$topIconWrap.css('opacity', 1);
				} else if(mode === this.STATUS_PULLING_UP){//console.log('选择foot');
					this._$funcIcon = this._$footIcon;
					this._$funcIconWrap = this._$footIconWrap.css('opacity', 1);
				} else if(!mode){//console.log('隐藏icon');
					this._$topIconWrap.css('opacity', 0);
					this._$footIconWrap && this._$footIconWrap.css('opacity', 0);
					this._$funcIcon = null;
					this._$funcIconWrap = null;
				}
			}
		},

		_dragIcon: function(e, initOnly){

			if(initOnly === 'initOnly'){
				if(this.rAF_dragIcon) {return}//console.log('start  rAF_dragIcon');
				// 在touchMove执行_dragIcon方法需要初始化拖拽的条件:1,阻止默认事件;2,设CSS过渡;
				this._renderFuncIcon(this._status);
				this._setTransition(this._$funcIconWrap, 200);
				this._setTransition(this._$funcIcon, 200);
				this.rAF_dragIcon = true;
				// 此处应该放在config
				this.rage = 3;
				this.maxL = this._config.triggerOffset * this.rage;
			}
			if(!this.rAF_dragIcon){return}//console.log('rAF',initOnly);

			var originalY = this._draggingY < 0 ? -this._draggingY : this._draggingY,
				dragY = originalY;

			// 拖拽的角度
			var rotateDeg = dragY * this._dragDegPerY;
			if(Math.abs(rotateDeg - this.saveData.deg) >= 3){
				this.saveData.deg = rotateDeg;
				this._rotateIcon(rotateDeg, this._$funcIcon);
			}

			// 拖拽的距离
			if(dragY < this.maxL){
				dragY = Math.sqrt((2 * this.maxL - dragY) * dragY) / this.rage;
				dragY = dragY > originalY ? originalY : dragY;

				if(Math.abs(dragY - this.saveData.dragY) >= 3){
					this.saveData.dragY = dragY;
					this._setIconPos(dragY, this._$funcIconWrap);
				}
			}

			//递归循环
			rAF($.proxy(this._dragIcon, this));
		},

		_setIconPos: function(distance, $obj){
			var posProps = {};

			// 若是footIcon, 调整为反方向的位移
			if(this._mode == this.STATUS_PULLING_UP && distance > 0){distance = -distance}

			if(distance !== this._iconPosY){
				this._iconPosY = distance;//console.log(distance);

				posProps[this._animType] = "translate3D(0, " + distance + "px, 0)";

				$obj.css(posProps);
			}
		},

		_rotateIcon: function(rotateDeg, $obj){
			// 旋转icon
			var rotateProps = {};//console.log('_rotateIcon', rotateDeg);

			this._iconDeg = rotateDeg;

			rotateProps[this._animType] = "rotateZ(" + rotateDeg + "deg)";

			$obj.css(rotateProps);
		},

		_setTransition: function($obj, duration){
			var transition = {};

			transition[this._transitionType] = this._transformType + ' ' + duration + 'ms linear';

			$obj.css(transition);
		},

		_setCssProps: function(){
			// 环境检测可用的css属性: 能否使用transition, 能否使用transform
			var bodyStyle = document.body.style;
			if (bodyStyle.OTransform !== undefined){
				this._animType = 'OTransform';
				this._transformType = '-o-transform';
				this._transitionType = 'OTransition';
			}
			if (bodyStyle.MozTransform !== undefined){
				this._animType = 'MozTransform';
				this._transformType = '-moz-transform';
				this._transitionType = 'MozTransition';
			}
			if (bodyStyle.webkitTransform !== undefined){
				this._animType = 'webkitTransform';
				this._transformType = '-webkit-transform';
				this._transitionType = 'webkitTransition';
			}
			if (bodyStyle.msTransform !== undefined){
				this._animType = 'msTransform';
				this._transformType = '-ms-transform';
				this._transitionType = 'msTransition';
			}
			if (bodyStyle.transform !== undefined){
				this._animType = 'transform';
				this._transformType = 'transform';
				this._transitionType = 'transition';
			}
		},

		/**
		 * @desc 触发"下拉刷新"事件,一般用于首次加载数据
		 * @memberof Nuui.Scroll
		 * @func triggerRefresh
		 * @instance
		 */
		triggerRefresh: function(){
			this._status = this.STATUS_TRIGGER_PULL_DOWN;
			this._renderFuncIcon(this.STATUS_PULLING_DOWN);
			this._setIconPos(this._config.triggerOffset, this._$funcIconWrap);
			this._setIconRun();
			this._refreshData();
		},

		/**
		 * @desc 触发"退出加载状态"事件,一般用于同步服务器失败的回调方法里
		 * @memberof Nuui.Scroll
		 * @func triggerHide
		 * @instance
		 */
		triggerHide: function(){
			this._refresh();
		}
	}
});